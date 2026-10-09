"""SPE local hardware discovery and conservative execution placement.

Observational planning only: never loads weights, invokes cloud services or authorizes spend.
A LOCAL_ENGINE result means zero *external inference API charge*, not zero electricity,
hardware depreciation, or operating cost. GPU/NNAPI presence is not a model compatibility
proof; the caller must separately qualify the runtime, operators, weights and backend.

All memory quantities are integer bytes. No floating-point cost calculations are used.
"""

from __future__ import annotations

import ctypes
import importlib
import platform
import re
import shutil
import subprocess
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Protocol


NANOS_PER_USD = 1_000_000_000


class NanoUSD(int):
    """Nonnegative integer nanodollars. Constructing from float/bool is forbidden."""

    def __new__(cls, value: int) -> "NanoUSD":
        if type(value) is not int:
            raise TypeError("NanoUSD requires an exact integer, not float/bool")
        if value < 0:
            raise ValueError("NanoUSD cannot be negative")
        return int.__new__(cls, value)


class Accelerator(StrEnum):
    METAL = "METAL"
    CUDA = "CUDA"
    ROCM = "ROCM"
    NNAPI = "NNAPI"
    CPU_AVX512 = "CPU_AVX512"
    CPU_ARM_NEON = "CPU_ARM_NEON"
    CPU_GENERIC = "CPU_GENERIC"
    UNKNOWN = "UNKNOWN"


class ThermalState(StrEnum):
    NOMINAL = "NOMINAL"
    FAIR = "FAIR"
    SERIOUS = "SERIOUS"
    CRITICAL = "CRITICAL"
    UNKNOWN = "UNKNOWN"


class PowerSource(StrEnum):
    AC = "AC"
    BATTERY = "BATTERY"
    BATTERY_LOW = "BATTERY_LOW"
    UNKNOWN = "UNKNOWN"


class Placement(StrEnum):
    LOCAL_ENGINE = "LOCAL_ENGINE"
    FALLBACK_RECOMMENDED = "FALLBACK_RECOMMENDED"


def _nonnegative_int(value: int | None, label: str) -> None:
    if value is not None and (type(value) is not int or value < 0):
        raise ValueError(f"{label} must be nonnegative integer bytes or None")


@dataclass(frozen=True, slots=True)
class HardwareSnapshot:
    accelerator: Accelerator
    free_memory_bytes: int | None
    total_memory_bytes: int | None
    thermal_state: ThermalState = ThermalState.UNKNOWN
    power_source: PowerSource = PowerSource.UNKNOWN
    cpu_architecture: str = "unknown"
    device_name: str = "unknown"
    evidence: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        _nonnegative_int(self.free_memory_bytes, "free_memory_bytes")
        _nonnegative_int(self.total_memory_bytes, "total_memory_bytes")
        if (self.free_memory_bytes is not None and self.total_memory_bytes is not None
                and self.free_memory_bytes > self.total_memory_bytes):
            raise ValueError("available memory exceeds total memory")


@dataclass(frozen=True, slots=True)
class DeviceProfile:
    accelerator: Accelerator
    free_memory_bytes: int | None
    total_memory_bytes: int | None
    thermal_state: ThermalState
    power_source: PowerSource
    parameter_ceiling: int
    cpu_architecture: str
    device_name: str
    evidence: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class ModelRequirement:
    weight_bytes: int
    parameter_count: int

    def __post_init__(self) -> None:
        if type(self.weight_bytes) is not int or self.weight_bytes <= 0:
            raise ValueError("model footprint must be a positive number of bytes")
        if type(self.parameter_count) is not int or self.parameter_count < 0:
            raise ValueError("parameter count must be a nonnegative integer")


@dataclass(frozen=True, slots=True)
class PlacementDecision:
    placement: Placement
    reason: str
    profile: DeviceProfile
    estimated_cost: NanoUSD | None
    authorized_remote_execution: bool = False


class Probe(Protocol):
    def snapshot(self) -> HardwareSnapshot: ...


# Conservative policy caps; UNKNOWN deliberately gets the CRITICAL derating.
_THERMAL_PERCENT: dict[ThermalState, int] = {
    ThermalState.NOMINAL: 100,
    ThermalState.FAIR: 75,
    ThermalState.SERIOUS: 50,
    ThermalState.CRITICAL: 25,
    ThermalState.UNKNOWN: 25,
}


class DeviceProfiler:
    """Re-query live measurements on every decision; no stale placement cache."""

    def __init__(self, probe: Probe | None = None, *, nominal_parameter_ceiling: int = 8_000_000_000):
        if type(nominal_parameter_ceiling) is not int or nominal_parameter_ceiling <= 0:
            raise ValueError("nominal_parameter_ceiling must be positive integer")
        self._probe = probe if probe is not None else SystemHardwareProbe()
        self._nominal_parameter_ceiling = nominal_parameter_ceiling

    def profile(self) -> DeviceProfile:
        snap = self._probe.snapshot()
        ceiling = self._nominal_parameter_ceiling * _THERMAL_PERCENT[snap.thermal_state] // 100
        if snap.power_source == PowerSource.BATTERY_LOW:
            ceiling = ceiling // 2
        return DeviceProfile(
            accelerator=snap.accelerator,
            free_memory_bytes=snap.free_memory_bytes,
            total_memory_bytes=snap.total_memory_bytes,
            thermal_state=snap.thermal_state,
            power_source=snap.power_source,
            parameter_ceiling=ceiling,
            cpu_architecture=snap.cpu_architecture,
            device_name=snap.device_name,
            evidence=snap.evidence,
        )

    def place(self, model: ModelRequirement) -> PlacementDecision:
        p = self.profile()

        def fallback(reason: str) -> PlacementDecision:
            # No remote tariff can be assumed; never authorize a remote call implicitly.
            return PlacementDecision(Placement.FALLBACK_RECOMMENDED, reason, p, None)

        if p.accelerator == Accelerator.UNKNOWN:
            return fallback("NO_SUPPORTED_EXECUTION_BACKEND")
        if p.free_memory_bytes is None:
            return fallback("UNKNOWN_AVAILABLE_MEMORY")
        # Integer-only >= 1.5× footprint. This is a pre-load *admission* guard.
        if 2 * p.free_memory_bytes < 3 * model.weight_bytes:
            return fallback("INSUFFICIENT_MEMORY_HEADROOM")
        if model.parameter_count > p.parameter_ceiling:
            return fallback("THERMAL_PARAMETER_CEILING")
        return PlacementDecision(Placement.LOCAL_ENGINE, "LOCAL_RESOURCES_ADMISSIBLE", p, NanoUSD(0))


class SystemHardwareProbe:
    """Best-effort actual OS queries, declining unverified accelerator claims.

    Dedicated GPU memory is taken from NVML/torch and unified memory from the OS.
    NNAPI is deprecated from Android 15 onward: presence alone is not a guarantee
    that the driver can execute any particular model or operator.
    """

    @staticmethod
    def _run(args: list[str], timeout: float = 1.5) -> str:
        if not shutil.which(args[0]):
            return ""
        try:
            return subprocess.run(args, capture_output=True, text=True, timeout=timeout,
                                  check=False).stdout.strip()
        except (OSError, subprocess.TimeoutExpired, UnicodeError):
            return ""

    @staticmethod
    def _safe_optional_import(name: str):
        try:
            return importlib.import_module(name)
        except (ImportError, OSError, RuntimeError):
            return None

    def _metal_available(self) -> bool:
        if platform.system() != "Darwin" or platform.machine().lower() not in ("arm64", "aarch64"):
            return False
        try:
            metal = ctypes.CDLL("/System/Library/Frameworks/Metal.framework/Metal")
            metal.MTLCreateSystemDefaultDevice.restype = ctypes.c_void_p
            device = metal.MTLCreateSystemDefaultDevice()
            if device:
                # MTLCreateSystemDefaultDevice follows the Create rule (caller owns +1).
                try:
                    objc = ctypes.CDLL("/usr/lib/libobjc.A.dylib")
                    objc.objc_release.argtypes = [ctypes.c_void_p]
                    objc.objc_release(device)
                except (OSError, AttributeError):
                    pass
            return bool(device)
        except (OSError, AttributeError):
            return False

    def _nvidia_memory(self) -> tuple[int, int] | None:
        nvml = self._safe_optional_import("pynvml")
        if nvml is not None:
            ready = False
            try:
                nvml.nvmlInit()
                ready = True
                if nvml.nvmlDeviceGetCount() > 0:
                    dev = nvml.nvmlDeviceGetHandleByIndex(0)
                    info = nvml.nvmlDeviceGetMemoryInfo(dev)
                    if int(info.total) > 0:
                        return int(info.free), int(info.total)
            except (Exception,):  # optional drivers can raise platform-specific errors
                pass
            finally:
                if ready:
                    try:
                        nvml.nvmlShutdown()
                    except Exception:
                        pass
        # nvidia-smi uses MiB for these fields, not SI megabytes.
        raw = self._run(["nvidia-smi", "--query-gpu=memory.free,memory.total",
                         "--format=csv,noheader,nounits"])
        if raw:
            match = re.fullmatch(r"\s*(\d+)\s*,\s*(\d+)\s*", raw.splitlines()[0])
            if match and int(match[2]) > 0 and int(match[1]) <= int(match[2]):
                return int(match[1]) * 1024 ** 2, int(match[2]) * 1024 ** 2
        torch = self._safe_optional_import("torch")
        if torch is not None:
            try:
                if (torch.cuda.is_available() and not getattr(torch.version, "hip", None)
                        and getattr(torch.version, "cuda", None)):
                    free, total = torch.cuda.mem_get_info(0)
                    return int(free), int(total)
            except (AttributeError, RuntimeError, OSError):
                pass
        return None

    def _rocm_memory(self) -> tuple[int, int] | None:
        torch = self._safe_optional_import("torch")
        if torch is not None:
            try:
                if torch.cuda.is_available() and getattr(torch.version, "hip", None):
                    free, total = torch.cuda.mem_get_info(0)
                    if int(total) > 0 and 0 <= int(free) <= int(total):
                        return int(free), int(total)
            except (AttributeError, RuntimeError, OSError):
                pass
        return None

    def _android_nnapi(self) -> bool:
        if platform.system() != "Linux" or not Path("/system/build.prop").exists():
            return False
        soc = " ".join((self._run(["getprop", "ro.soc.manufacturer"]),
                        self._run(["getprop", "ro.board.platform"]))).lower()
        if not any(x in soc for x in ("qualcomm", "qcom", "qti", "sm8", "sdm")):
            return False
        try:
            lib = ctypes.CDLL("libneuralnetworks.so")
            count = ctypes.c_uint32()
            lib.ANeuralNetworks_getDeviceCount.argtypes = [ctypes.POINTER(ctypes.c_uint32)]
            lib.ANeuralNetworks_getDeviceCount.restype = ctypes.c_int
            if lib.ANeuralNetworks_getDeviceCount(ctypes.byref(count)) != 0:
                return False
            lib.ANeuralNetworks_getDevice.argtypes = [ctypes.c_uint32, ctypes.POINTER(ctypes.c_void_p)]
            lib.ANeuralNetworks_getDevice.restype = ctypes.c_int
            lib.ANeuralNetworksDevice_getType.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_int)]
            lib.ANeuralNetworksDevice_getType.restype = ctypes.c_int
            lib.ANeuralNetworksDevice_getName.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_char_p)]
            lib.ANeuralNetworksDevice_getName.restype = ctypes.c_int
            for i in range(min(count.value, 128)):
                device = ctypes.c_void_p()
                kind = ctypes.c_int()
                name = ctypes.c_char_p()
                if (lib.ANeuralNetworks_getDevice(i, ctypes.byref(device)) == 0
                        and lib.ANeuralNetworksDevice_getType(device, ctypes.byref(kind)) == 0
                        and lib.ANeuralNetworksDevice_getName(device, ctypes.byref(name)) == 0):
                    label = (name.value or b"").decode("utf-8", "replace").lower()
                    if kind.value == 3 and any(v in label for v in ("qti", "qualcomm", "hexagon", "dsp", "hta")):
                        return True
        except (OSError, AttributeError, ValueError):
            pass
        return False

    def _memory_available(self) -> tuple[int | None, int | None]:
        if platform.system() == "Darwin":
            raw_total = self._run(["sysctl", "-n", "hw.memsize"])
            total = int(raw_total) if raw_total.isdigit() else None
            vm = self._run(["vm_stat"])
            m = re.search(r"page size of (\d+) bytes", vm)
            if not m:
                return None, total
            page_size = int(m[1])
            # Exclude purgeable because it can overlap inactive pages.
            names = ("Pages free", "Pages inactive", "Pages speculative")
            vals = []
            for name in names:
                found = re.search(r"^" + re.escape(name) + r":\s*(\d+)\.", vm, re.M)
                if found:
                    vals.append(int(found[1]))
            free = sum(vals) * page_size if vals else None
            if free is not None and total is not None:
                free = min(free, total)
            return free, total
        if platform.system() == "Linux":
            try:
                data = Path("/proc/meminfo").read_text(encoding="ascii")
            except (OSError, UnicodeError):
                return None, None
            entries = {k: int(v) * 1024 for k, v in re.findall(r"^(\w+):\s*(\d+) kB", data, re.M)}
            return entries.get("MemAvailable"), entries.get("MemTotal")
        if platform.system() == "Windows":
            try:
                class MemoryStatus(ctypes.Structure):
                    _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                                ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                                ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                                ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                                ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
                status = MemoryStatus()
                status.dwLength = ctypes.sizeof(MemoryStatus)
                if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
                    return int(status.ullAvailPhys), int(status.ullTotalPhys)
            except (AttributeError, OSError):
                pass
        return None, None

    def _cpu_flags(self) -> str:
        if platform.system() == "Linux":
            try:
                return Path("/proc/cpuinfo").read_text(encoding="ascii", errors="replace").lower()
            except OSError:
                return ""
        if platform.system() == "Darwin":
            return (self._run(["sysctl", "-n", "machdep.cpu.features"]) + " " +
                    self._run(["sysctl", "-n", "machdep.cpu.leaf7_features"])).lower()
        return ""

    def _cpu_backend(self) -> Accelerator:
        arch = platform.machine().lower()
        if arch in ("x86_64", "amd64", "i386", "i686"):
            if "avx512f" in self._cpu_flags().lower().replace("_", ""):
                return Accelerator.CPU_AVX512
        elif arch in ("aarch64", "arm64", "armv8l", "armv7l"):
            # ARM uses NEON/SVE rather than Intel's AVX-512 instruction set.
            if arch in ("aarch64", "arm64") or "neon" in self._cpu_flags():
                return Accelerator.CPU_ARM_NEON
        return Accelerator.CPU_GENERIC

    def _thermal_state(self) -> ThermalState:
        if platform.system() == "Darwin":
            foundation = self._safe_optional_import("Foundation")  # optional PyObjC
            if foundation is not None:
                try:
                    raw = int(foundation.NSProcessInfo.processInfo().thermalState())
                    return {0: ThermalState.NOMINAL, 1: ThermalState.FAIR,
                            2: ThermalState.SERIOUS, 3: ThermalState.CRITICAL}.get(raw, ThermalState.UNKNOWN)
                except (AttributeError, ValueError, TypeError):
                    pass
        if platform.system() == "Linux":
            # Prefer explicit OS-exposed trip temperatures over arbitrary vendor thresholds.
            worst = ThermalState.UNKNOWN
            rank = {ThermalState.UNKNOWN: -1, ThermalState.NOMINAL: 0,
                    ThermalState.FAIR: 1, ThermalState.SERIOUS: 2, ThermalState.CRITICAL: 3}
            for zone in Path("/sys/class/thermal").glob("thermal_zone*"):
                try:
                    cur = int((zone / "temp").read_text().strip())
                    critical_file = zone / "trip_point_0_temp"
                    if not critical_file.exists():
                        continue
                    trip = int(critical_file.read_text().strip())
                    if trip <= 0 or cur < 0:
                        continue
                    # Relative bands indicate approach to one *reported* trip point only.
                    pct = cur * 100 // trip
                    state = (ThermalState.CRITICAL if pct >= 100 else
                             ThermalState.SERIOUS if pct >= 90 else
                             ThermalState.FAIR if pct >= 75 else ThermalState.NOMINAL)
                    if rank[state] > rank[worst]:
                        worst = state
                except (OSError, ValueError):
                    continue
            return worst
        return ThermalState.UNKNOWN

    def _power_source(self) -> PowerSource:
        if platform.system() == "Darwin":
            data = self._run(["pmset", "-g", "batt"])
            if "AC Power" in data:
                return PowerSource.AC
            if "Battery Power" in data:
                m = re.search(r"(\d+)%", data)
                return PowerSource.BATTERY_LOW if m and int(m[1]) < 20 else PowerSource.BATTERY
        if platform.system() == "Linux":
            for battery in Path("/sys/class/power_supply").glob("BAT*"):
                try:
                    status = (battery / "status").read_text().strip().lower()
                    if status in ("charging", "full"):
                        return PowerSource.AC
                    if status == "discharging":
                        capacity_path = battery / "capacity"
                        if capacity_path.exists() and int(capacity_path.read_text().strip()) < 20:
                            return PowerSource.BATTERY_LOW
                        return PowerSource.BATTERY
                except (OSError, ValueError):
                    continue
        return PowerSource.UNKNOWN

    def snapshot(self) -> HardwareSnapshot:
        arch = platform.machine().lower()
        os_name = platform.system()
        free, total = self._memory_available()
        backend = self._cpu_backend()
        device_name = platform.node() or "unknown"
        evidence = [f"os={os_name}", f"cpu_arch={arch}"]
        if os_name == "Darwin" and self._metal_available():
            backend = Accelerator.METAL
            evidence.append("metal=MTLCreateSystemDefaultDevice")
        elif os_name in ("Linux", "Windows"):
            if self._android_nnapi():
                backend = Accelerator.NNAPI
                evidence.append("nnapi=qualified-accelerator-enumeration")
            else:
                nvidia = self._nvidia_memory()
                if nvidia is not None:
                    backend = Accelerator.CUDA
                    free, total = nvidia
                    evidence.append("cuda=nvml/nvidia-smi/torch")
                else:
                    rocm = self._rocm_memory()
                    if rocm is not None:
                        backend = Accelerator.ROCM
                        free, total = rocm
                        evidence.append("rocm=torch-hip")
        return HardwareSnapshot(backend, free, total, self._thermal_state(),
                                self._power_source(), arch, device_name, tuple(evidence))
