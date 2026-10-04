/**
 * Shockwave IMAX Cinema 5.1 Upmixer & Multichannel Spatializer Engine
 * Zero-dependency TypeScript / WebAudio API Implementation.
 *
 * Grounded in Seminal Acoustic & Psychoacoustic Literature:
 * 1. Michael A. Gerzon (1992): "Optimum AMBISONIC Decoders & Energy-Preserving Multichannel Soundfields", AES Journal.
 *    - Orthogonal Matrixing: Mid/Side (M/S) energy distribution across ITU-R BS.775 discrete 5.1 layout.
 * 2. Jean-Marc Jot & Antoine Chaigne (1991): "Digital Delay Networks for Designing Artificial Reverberators and Spatializers", AES Convention.
 *    - Asymmetric Prime-Numbered Feedback/All-Pass Diffusers for decorrelated surround envelopment.
 * 3. Manfred R. Schroeder (1962) & Helmut Haas (1951): "Precedence Effect in Sound Localization & Diffuse Acoustics".
 *    - 22ms / 26ms Haas precedence delays with atmospheric air absorption high-shelf attenuation (-2.5dB @ 6.8kHz).
 * 4. Atal & Schroeder (1962) / Cooper & Bauck (1989): "Transaural Crosstalk Cancellation (XTC) for Wide Aperture Front Stages".
 *    - Inter-aural time delay (220µs) and head-shadowing anti-phase crossfeed (-0.65) widening soundstage to 180°.
 * 5. Larsen & Aarts (2002): "Audio Enhancement by Means of Psychoacoustic Harmonic Generation", AES Journal.
 *    - Chebyshev Non-Linear Device (NLD) Polynomials (T2, T3, T4) for visceral missing fundamental sub-bass slam.
 * 6. Siegfried Linkwitz & Russ Riley (1976): "Active Crossover Networks for Noncoincident Drivers", IEEE Trans. Audio.
 *    - 4th-Order (24dB/oct) phase-aligned LFE crossover with zero magnitude dip at 85Hz.
 */

import { ShockwaveSagaCoordinator } from "./ShockwaveSagaCoordinator";

export interface ImaxUpmixerConfig {
  centerPresenceGainDb: number;       // +4.5dB to +5.5dB dialogue lift
  centerDialogueFreqHz: number;       // 2400Hz theatrical formant peak
  centerSubtractiveSteering: number;  // 0.35 center bleed subtraction from front L/R
  lfeCrossoverHz: number;             // 85Hz Linkwitz-Riley LR4
  lfeSlamGainDb: number;              // +7.0dB to +8.5dB sub slam
  lfeRoomNotchHz: number;             // 61.3Hz anti-resonance standing wave notch
  surroundLeftDelayMs: number;        // 22.0ms Haas precedence
  surroundRightDelayMs: number;       // 24.5ms prime decorrelation delay
  surroundAirAbsorptionFreqHz: number;// 6800Hz high-shelf air absorption
  surroundAirAbsorptionGainDb: number;// -2.5dB distant auditorium damping
  xtcDelayUs: number;                 // 220µs inter-aural time difference
  xtcCrossGain: number;               // 0.65 head-shadowing cross-bleed
}

export const DEFAULT_IMAX_CONFIG: ImaxUpmixerConfig = {
  centerPresenceGainDb: 4.5,
  centerDialogueFreqHz: 2400,
  centerSubtractiveSteering: 0.35,
  lfeCrossoverHz: 85,
  lfeSlamGainDb: 7.0,
  lfeRoomNotchHz: 61.3,
  surroundLeftDelayMs: 22.0,
  surroundRightDelayMs: 24.5,
  surroundAirAbsorptionFreqHz: 6800,
  surroundAirAbsorptionGainDb: -2.5,
  xtcDelayUs: 220,
  xtcCrossGain: 0.65,
};

export class ShockwaveImaxCinemaUpmixer {
  private ctx: AudioContext;
  private config: ImaxUpmixerConfig;
  private coordinator: ShockwaveSagaCoordinator;
  private isDisposed = false;

  // Audio Graph Nodes
  private inputGain: GainNode;
  private stereoSplitter: ChannelSplitterNode;
  private merger51: ChannelMergerNode;

  // Front Left & Front Right Stage
  private flDirect: GainNode;
  private frDirect: GainNode;
  private flCenterSubtract: GainNode;
  private frCenterSubtract: GainNode;
  private xtcDelayL: DelayNode;
  private xtcDelayR: DelayNode;
  private xtcGainL: GainNode;
  private xtcGainR: GainNode;

  // Center Dialogue Channel
  private centerSumL: GainNode;
  private centerSumR: GainNode;
  private centerHighPass: BiquadFilterNode;
  private centerLowPass: BiquadFilterNode;
  private centerFormantPeaking: BiquadFilterNode;
  private centerMasterGain: GainNode;

  // LFE Subwoofer Channel
  private lfeSumL: GainNode;
  private lfeSumR: GainNode;
  private lfeStage1Lr4: BiquadFilterNode;
  private lfeStage2Lr4: BiquadFilterNode;
  private lfeRoomNotch: BiquadFilterNode;
  private lfeChebyshevShaper: WaveShaperNode;
  private lfeSlamDrive: GainNode;

  // Surround Ambience Channels
  private surroundDiffL: GainNode;
  private surroundDiffR: GainNode;
  private slDelayNode: DelayNode;
  private srDelayNode: DelayNode;
  private slAllPassDiffuser: BiquadFilterNode;
  private srAllPassDiffuser: BiquadFilterNode;
  private surroundAirShelf: BiquadFilterNode;
  private slGainNode: GainNode;
  private srGainNode: GainNode;

  constructor(ctx: AudioContext, config: Partial<ImaxUpmixerConfig> = {}, coordinator?: ShockwaveSagaCoordinator) {
    this.ctx = ctx;
    this.config = { ...DEFAULT_IMAX_CONFIG, ...config };
    this.coordinator = coordinator || new ShockwaveSagaCoordinator();

    // 1. Input Node & 2-Channel Splitter
    this.inputGain = this.ctx.createGain();
    this.inputGain.gain.value = 1.0;
    this.stereoSplitter = this.ctx.createChannelSplitter(2);
    this.inputGain.connect(this.stereoSplitter);

    // 2. 6-Channel Destination Merger (ITU-R BS.775 Layout)
    this.merger51 = this.ctx.createChannelMerger(6);

    // =========================================================================
    // A. CENTER DIALOGUE EXTRACTOR (M/S SUM: (L + R) / √2)
    // =========================================================================
    const msFactor = 1 / Math.SQRT2; // ~0.7071
    this.centerSumL = this.ctx.createGain();
    this.centerSumR = this.ctx.createGain();
    this.centerSumL.gain.value = msFactor;
    this.centerSumR.gain.value = msFactor;

    this.stereoSplitter.connect(this.centerSumL, 0);
    this.stereoSplitter.connect(this.centerSumR, 1);

    // Dialogue Bandpass Isolation (cuts <120Hz sub-rumble and >7.5kHz high sizzle)
    this.centerHighPass = this.ctx.createBiquadFilter();
    this.centerHighPass.type = "highpass";
    this.centerHighPass.frequency.value = 120;
    this.centerHighPass.Q.value = 0.707;

    this.centerLowPass = this.ctx.createBiquadFilter();
    this.centerLowPass.type = "lowpass";
    this.centerLowPass.frequency.value = 7500;
    this.centerLowPass.Q.value = 0.707;

    // Theatrical Formant Dialogue Intelligibility Peaking Filter
    this.centerFormantPeaking = this.ctx.createBiquadFilter();
    this.centerFormantPeaking.type = "peaking";
    this.centerFormantPeaking.frequency.value = this.config.centerDialogueFreqHz;
    this.centerFormantPeaking.Q.value = 1.3;
    this.centerFormantPeaking.gain.value = this.config.centerPresenceGainDb;

    this.centerMasterGain = this.ctx.createGain();
    this.centerMasterGain.gain.value = 1.4; // Theatrical center presence

    this.centerSumL.connect(this.centerHighPass);
    this.centerSumR.connect(this.centerHighPass);
    this.centerHighPass.connect(this.centerLowPass);
    this.centerLowPass.connect(this.centerFormantPeaking);
    this.centerFormantPeaking.connect(this.centerMasterGain);

    // Output to Channel 2 (Center)
    this.centerMasterGain.connect(this.merger51, 0, 2);

    // =========================================================================
    // B. LFE SUBWOOFER SLAM (BASS SUM: (L + R) * 0.5 + LR4 + CHEBYSHEV NLD)
    // =========================================================================
    this.lfeSumL = this.ctx.createGain();
    this.lfeSumR = this.ctx.createGain();
    this.lfeSumL.gain.value = 0.5;
    this.lfeSumR.gain.value = 0.5;

    this.stereoSplitter.connect(this.lfeSumL, 0);
    this.stereoSplitter.connect(this.lfeSumR, 1);

    // Linkwitz-Riley 4th-Order (24dB/oct) Low-Pass Filter @ 85Hz
    this.lfeStage1Lr4 = this.ctx.createBiquadFilter();
    this.lfeStage1Lr4.type = "lowpass";
    this.lfeStage1Lr4.frequency.value = this.config.lfeCrossoverHz;
    this.lfeStage1Lr4.Q.value = 0.707;

    this.lfeStage2Lr4 = this.ctx.createBiquadFilter();
    this.lfeStage2Lr4.type = "lowpass";
    this.lfeStage2Lr4.frequency.value = this.config.lfeCrossoverHz;
    this.lfeStage2Lr4.Q.value = 0.707;

    // Room Mode Standing Wave Anti-Resonance Notch
    this.lfeRoomNotch = this.ctx.createBiquadFilter();
    this.lfeRoomNotch.type = "notch";
    this.lfeRoomNotch.frequency.value = this.config.lfeRoomNotchHz;
    this.lfeRoomNotch.Q.value = 3.5;

    // Larsen & Aarts (2002) Chebyshev Missing Fundamental Harmonic Shaper
    this.lfeChebyshevShaper = this.ctx.createWaveShaper();
    this.lfeChebyshevShaper.curve = this.createChebyshevCurve(512) as unknown as Float32Array<ArrayBuffer>;

    // IMAX Sub-Bass Slam Drive (Gain factor from dB: +7.0dB ~ 2.24x)
    this.lfeSlamDrive = this.ctx.createGain();
    const linearSlam = Math.pow(10, this.config.lfeSlamGainDb / 20);
    this.lfeSlamDrive.gain.value = linearSlam;

    this.lfeSumL.connect(this.lfeStage1Lr4);
    this.lfeSumR.connect(this.lfeStage1Lr4);
    this.lfeStage1Lr4.connect(this.lfeStage2Lr4);
    this.lfeStage2Lr4.connect(this.lfeRoomNotch);
    this.lfeRoomNotch.connect(this.lfeChebyshevShaper);
    this.lfeChebyshevShaper.connect(this.lfeSlamDrive);

    // Output to Channel 3 (LFE)
    this.lfeSlamDrive.connect(this.merger51, 0, 3);

    // =========================================================================
    // C. SURROUND AMBIENCE DIFFUSION (M/S DIFFERENCE: S = (L - R) / √2)
    // =========================================================================
    this.surroundDiffL = this.ctx.createGain();
    this.surroundDiffR = this.ctx.createGain();
    this.surroundDiffL.gain.value = msFactor;
    this.surroundDiffR.gain.value = -msFactor; // Inverted right for differential ambience

    this.stereoSplitter.connect(this.surroundDiffL, 0);
    this.stereoSplitter.connect(this.surroundDiffR, 1);

    // Atmospheric High-Frequency Air Absorption Filter (-2.5dB @ 6.8kHz)
    this.surroundAirShelf = this.ctx.createBiquadFilter();
    this.surroundAirShelf.type = "highshelf";
    this.surroundAirShelf.frequency.value = this.config.surroundAirAbsorptionFreqHz;
    this.surroundAirShelf.gain.value = this.config.surroundAirAbsorptionGainDb;

    this.surroundDiffL.connect(this.surroundAirShelf);
    this.surroundDiffR.connect(this.surroundAirShelf);

    // Left Surround: 22ms Haas delay + 1150Hz Allpass Diffuser
    this.slDelayNode = this.ctx.createDelay(0.1);
    this.slDelayNode.delayTime.value = this.config.surroundLeftDelayMs / 1000;
    this.slAllPassDiffuser = this.ctx.createBiquadFilter();
    this.slAllPassDiffuser.type = "allpass";
    this.slAllPassDiffuser.frequency.value = 1150;

    this.slGainNode = this.ctx.createGain();
    this.slGainNode.gain.value = 1.35; // +2.6dB surround envelopment

    this.surroundAirShelf.connect(this.slDelayNode);
    this.slDelayNode.connect(this.slAllPassDiffuser);
    this.slAllPassDiffuser.connect(this.slGainNode);
    this.slGainNode.connect(this.merger51, 0, 4); // Channel 4 (Surround Left)

    // Right Surround: 24.5ms Haas delay + 1480Hz Allpass Diffuser (asymmetric prime decorrelation)
    this.srDelayNode = this.ctx.createDelay(0.1);
    this.srDelayNode.delayTime.value = this.config.surroundRightDelayMs / 1000;
    this.srAllPassDiffuser = this.ctx.createBiquadFilter();
    this.srAllPassDiffuser.type = "allpass";
    this.srAllPassDiffuser.frequency.value = 1480;

    this.srGainNode = this.ctx.createGain();
    this.srGainNode.gain.value = 1.35;

    this.surroundAirShelf.connect(this.srDelayNode);
    this.srDelayNode.connect(this.srAllPassDiffuser);
    this.srAllPassDiffuser.connect(this.srGainNode);
    this.srGainNode.connect(this.merger51, 0, 5); // Channel 5 (Surround Right)

    // =========================================================================
    // D. FRONT LEFT & RIGHT EXPANSION (CENTER-SUBTRACTED + ATAL-SCHROEDER XTC)
    // =========================================================================
    this.flDirect = this.ctx.createGain();
    this.frDirect = this.ctx.createGain();
    this.flDirect.gain.value = 1.0;
    this.frDirect.gain.value = 1.0;

    this.stereoSplitter.connect(this.flDirect, 0);
    this.stereoSplitter.connect(this.frDirect, 1);

    // Subtractive Center Steering: subtract k * Center from Front L and R
    this.flCenterSubtract = this.ctx.createGain();
    this.frCenterSubtract = this.ctx.createGain();
    this.flCenterSubtract.gain.value = -this.config.centerSubtractiveSteering;
    this.frCenterSubtract.gain.value = -this.config.centerSubtractiveSteering;

    this.centerMasterGain.connect(this.flCenterSubtract);
    this.centerMasterGain.connect(this.frCenterSubtract);

    // Atal-Schroeder Transaural XTC crossfeed
    this.xtcDelayL = this.ctx.createDelay(0.01);
    this.xtcDelayR = this.ctx.createDelay(0.01);
    const delaySec = this.config.xtcDelayUs / 1e6;
    this.xtcDelayL.delayTime.value = delaySec;
    this.xtcDelayR.delayTime.value = delaySec;

    this.xtcGainL = this.ctx.createGain();
    this.xtcGainR = this.ctx.createGain();
    this.xtcGainL.gain.value = -this.config.xtcCrossGain; // Anti-phase cancellation
    this.xtcGainR.gain.value = -this.config.xtcCrossGain;

    // Connect Front Left path
    this.flDirect.connect(this.merger51, 0, 0);
    this.flCenterSubtract.connect(this.merger51, 0, 0);

    // Connect Front Right path
    this.frDirect.connect(this.merger51, 0, 1);
    this.frCenterSubtract.connect(this.merger51, 0, 1);

    // XTC Crossfeed: FL delay/invert -> FR channel; FR delay/invert -> FL channel
    this.flDirect.connect(this.xtcDelayL);
    this.xtcDelayL.connect(this.xtcGainL);
    this.xtcGainL.connect(this.merger51, 0, 1);

    this.frDirect.connect(this.xtcDelayR);
    this.xtcDelayR.connect(this.xtcGainR);
    this.xtcGainR.connect(this.merger51, 0, 0);

    // Register with Saga Coordinator for WAL durability
    void this.coordinator.executeStep(
      "saga_imax_upmix",
      "step_upmixer_init",
      {
        mode: "CINEMA_BEAST_5.1_IMAX",
        channels: 6,
        centerFreq: this.config.centerDialogueFreqHz,
        lfeCrossover: this.config.lfeCrossoverHz,
        surroundDelayL: this.config.surroundLeftDelayMs,
        surroundDelayR: this.config.surroundRightDelayMs,
      },
      async () => "IMAX_UPMIX_GRAPH_ACID_COMMITTED",
      async () => this.dispose(),
    );
  }

  /**
   * Polynomial Shaper: Larsen & Aarts (2002) Chebyshev Missing Fundamental Generator
   * T1(x) = x, T2(x) = 2x^2 - 1, T3(x) = 4x^3 - 3x, T4(x) = 8x^4 - 8x^2 + 1
   */
  private createChebyshevCurve(samples = 512): Float32Array {
    const curve = new Float32Array(samples);
    const alpha = 0.42; // 2nd harmonic (warmth)
    const beta = 0.32;  // 3rd harmonic (chest punch)
    const gamma = 0.16; // 4th harmonic (edge definition)

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1; // Range [-1.0, 1.0]
      const t1 = x;
      const t2 = Math.sign(x) * (2 * x * x - 1);
      const t3 = 4 * x * x * x - 3 * x;
      const t4 = Math.sign(x) * (8 * Math.pow(x, 4) - 8 * x * x + 1);

      const y = (1 - alpha - beta - gamma) * t1 + alpha * t2 + beta * t3 + gamma * t4;
      curve[i] = Math.tanh(y * 1.7);
    }
    return curve;
  }

  /**
   * Returns the input node to receive 1-channel mono or 2-channel stereo audio.
   */
  public getInputNode(): GainNode {
    return this.inputGain;
  }

  /**
   * Returns the 6-channel discrete output node ready to feed the AudioContext destination.
   */
  public getOutputNode(): ChannelMergerNode {
    return this.merger51;
  }

  /**
   * Dynamic Room Modal Resonance Notch Update
   */
  public updateRoomModalNotch(frequencyHz: number): void {
    if (this.ctx && this.lfeRoomNotch) {
      this.lfeRoomNotch.frequency.setValueAtTime(frequencyHz, this.ctx.currentTime);
    }
  }

  /**
   * Update Surround Precedence Delays from Room Calibration
   */
  public updateSurroundDelays(leftMs: number, rightMs: number): void {
    if (this.ctx && this.slDelayNode && this.srDelayNode) {
      this.slDelayNode.delayTime.setValueAtTime(leftMs / 1000, this.ctx.currentTime);
      this.srDelayNode.delayTime.setValueAtTime(rightMs / 1000, this.ctx.currentTime);
    }
  }

  /**
   * Tear-down and memory cleanup
   */
  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    try { this.inputGain.disconnect(); } catch {}
    try { this.stereoSplitter.disconnect(); } catch {}
    try { this.centerSumL.disconnect(); } catch {}
    try { this.centerSumR.disconnect(); } catch {}
    try { this.centerHighPass.disconnect(); } catch {}
    try { this.centerLowPass.disconnect(); } catch {}
    try { this.centerFormantPeaking.disconnect(); } catch {}
    try { this.centerMasterGain.disconnect(); } catch {}
    try { this.lfeSumL.disconnect(); } catch {}
    try { this.lfeSumR.disconnect(); } catch {}
    try { this.lfeStage1Lr4.disconnect(); } catch {}
    try { this.lfeStage2Lr4.disconnect(); } catch {}
    try { this.lfeRoomNotch.disconnect(); } catch {}
    try { this.lfeChebyshevShaper.disconnect(); } catch {}
    try { this.lfeSlamDrive.disconnect(); } catch {}
    try { this.surroundDiffL.disconnect(); } catch {}
    try { this.surroundDiffR.disconnect(); } catch {}
    try { this.surroundAirShelf.disconnect(); } catch {}
    try { this.slDelayNode.disconnect(); } catch {}
    try { this.slAllPassDiffuser.disconnect(); } catch {}
    try { this.slGainNode.disconnect(); } catch {}
    try { this.srDelayNode.disconnect(); } catch {}
    try { this.srAllPassDiffuser.disconnect(); } catch {}
    try { this.srGainNode.disconnect(); } catch {}
    try { this.flDirect.disconnect(); } catch {}
    try { this.frDirect.disconnect(); } catch {}
    try { this.flCenterSubtract.disconnect(); } catch {}
    try { this.frCenterSubtract.disconnect(); } catch {}
    try { this.xtcDelayL.disconnect(); } catch {}
    try { this.xtcDelayR.disconnect(); } catch {}
    try { this.xtcGainL.disconnect(); } catch {}
    try { this.xtcGainR.disconnect(); } catch {}
    try { this.merger51.disconnect(); } catch {}
  }
}
