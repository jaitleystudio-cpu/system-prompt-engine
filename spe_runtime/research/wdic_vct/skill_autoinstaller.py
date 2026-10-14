"""
Skill Auto-Installer & Dynamic Dispatcher for SPE Ω.
Part of WDIC-VCT & Counterfactual Witness Continuation (CWC).

Detects missing technical domain skills, validates security integrity
(guarding against malicious skill scripts / exfiltration), and auto-injects
or installs verified skills into agent execution prompts.
"""

import os
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple


@dataclass(frozen=True)
class SkillRequirement:
    """
    A technical capability requirement mapped to a specialized environment skill.
    """
    skill_name: str
    domain: str
    is_installed: bool
    install_command: str
    security_verdict: str  # "SAFE", "SUSPICIOUS", "REJECTED"
    rationale: str


@dataclass
class SkillInstallationProposal:
    """
    Proposal to dynamically install or inject missing skills into the runtime.
    """
    required_skills: List[SkillRequirement]
    missing_skills: List[SkillRequirement]
    injected_prompt_headers: List[str]
    is_safe: bool


class SkillAutoInstaller:
    """
    Automated skill discovery, security qualification, and prompt injector.
    Eliminates model cognitive load by mapping tasks to exact specialized skills.
    """

    KNOWN_SKILL_REGISTRY: Dict[str, Dict[str, str]] = {
        "frontend-design": {
            "domain": "UI/UX & Frontend Styling",
            "install": "skills install frontend-design",
            "keywords": "ui,css,react,frontend,layout,tailwind,styling,design,button,responsive",
        },
        "systematic-debugging": {
            "domain": "Error Diagnosis & Bug Fixing",
            "install": "skills install systematic-debugging",
            "keywords": "bug,error,exception,traceback,fix,debug,crash,investigate,fail",
        },
        "tdd-workflow": {
            "domain": "Test-Driven Development",
            "install": "skills install tdd-workflow",
            "keywords": "test,tdd,pytest,jest,assert,unit test,regression,mock",
        },
        "security-auditor": {
            "domain": "Cybersecurity & Access Control",
            "install": "skills install security-auditor",
            "keywords": "security,auth,jwt,token,csrf,xss,injection,crypto,credentials,secret",
        },
        "clerk-auth": {
            "domain": "Authentication & Session Management",
            "install": "skills install clerk-auth",
            "keywords": "clerk,oauth,session,login,signup,auth middleware",
        },
        "drizzle-orm-expert": {
            "domain": "Database Schema & ORM Management",
            "install": "skills install drizzle-orm-expert",
            "keywords": "drizzle,sql,schema,migration,postgres,database,query",
        },
        "postgres-best-practices": {
            "domain": "PostgreSQL Optimization & Storage",
            "install": "skills install postgres-best-practices",
            "keywords": "postgres,acid,transaction,index,pool,query optimization",
        },
        "nextjs-best-practices": {
            "domain": "Next.js App Router Architecture",
            "install": "skills install nextjs-best-practices",
            "keywords": "nextjs,server component,app router,server actions,hydration",
        },
        "performance-engineer": {
            "domain": "Runtime Latency & Observability",
            "install": "skills install performance-engineer",
            "keywords": "performance-engineer,latency,profiling,cpu,memory,benchmark,flamegraph,slow,bottleneck,cwv,inp,lcp,cls,core web vitals",
        },
        "writing-plans": {
            "domain": "Multi-Step Architecture & Planning",
            "install": "skills install writing-plans",
            "keywords": "writing-plans,plan,roadmap,architecture,multi-step,spec,design document",
        },
        "recallmax": {
            "domain": "Long-Context Memory & 500K-1M Token Compression",
            "install": "npx skills add christopherlhammer11-ai/recallmax",
            "keywords": "context,memory,recall,recallmax,long context,compress,token,tokens,rag,summarize,history",
        },
        "using-superpowers": {
            "domain": "Mandatory Pre-Execution Skill Discovery & Process Discipline",
            "install": "skills install using-superpowers",
            "keywords": "superpowers,using-superpowers,skill discovery,process discipline,workflow discipline",
        },
        "antigravity-design-expert": {
            "domain": "Spatial Glassmorphic UI, 3D CSS Transforms & Motion Engineering",
            "install": "skills install antigravity-design-expert",
            "keywords": "antigravity-design-expert,glassmorphic,glassmorphism,spatial,3d css,perspective,gsap,isometric",
        },
        "antigravity-skill-orchestrator": {
            "domain": "Dynamic Multi-Domain Skill Routing & Complexity Guardrails",
            "install": "skills install antigravity-skill-orchestrator",
            "keywords": "antigravity-skill-orchestrator,l-orchestrator,orchestrator,orchestrate,skill-orchestrator,skill combination,agent-memory-mcp,multi-domain",
        },
        "seo": {
            "domain": "Technical SEO, E-E-A-T Citations, Schema.org & GEO Readiness",
            "install": "skills install seo",
            "keywords": "seo,schema.org,json-ld,sitemap,eeat,core web vitals,inp,geo,search engine",
        },
        "product-design": {
            "domain": "Apple 10 Design Principles, Design Tokens & 6-Stage UX Flows",
            "install": "skills install product-design",
            "keywords": "product-design,apple design,design tokens,ux flow,wcag,accessibility,jony ive",
        },
        "design-taste-frontend": {
            "domain": "High-Craft UI, Bento 2.0 Grids, Liquid Glass Refraction & Dials 8/6/4",
            "install": "skills install design-taste-frontend",
            "keywords": "design-taste-frontend,bento,liquid glass,refraction,design variance,motion intensity,visual density",
        },
        "frontend-mobile-development-component-scaffold": {
            "domain": "Universal Web & React Native ComponentSpec Scaffolding",
            "install": "skills install frontend-mobile-development-component-scaffold",
            "keywords": "component-scaffold,frontend-mobile-development-component-scaffold,componentspec,propdefinition,react-native,aria",
        },
        "progressive-web-app": {
            "domain": "Offline-First PWA Manifest & Service Worker Cache Strategies",
            "install": "skills install progressive-web-app",
            "keywords": "pwa,progressive-web-app,service worker,sw.js,manifest.webmanifest,cache-first,network-first,stale-while-revalidate,offline",
        },
        "deep-research": {
            "domain": "Autonomous 3-Part Scientific Literature Synthesis & S-Capsules",
            "install": "skills install deep-research",
            "keywords": "deep-research,literature review,arxiv,executive summary,comparison table,research synthesis,s-capsule",
        },
        "error-diagnostics-error-trace": {
            "domain": "Tri-Origin (GOAL/WORLD/VERIFIER) Error Fingerprinting & Trace Playbooks",
            "install": "skills install error-diagnostics-error-trace",
            "keywords": "error-diagnostics-error-trace,error trace,tri-origin,fingerprint,alert threshold,root cause,recovery playbook",
        },
        "competitor-alternatives": {
            "domain": "Centralized Honest Competitor Comparison & CLI Migration Architecture",
            "install": "skills install competitor-alternatives",
            "keywords": "competitor,competitors,competitor-alternatives,alternative,alternatives,vs,comparison matrix,migration",
        },
        "docker-expert": {
            "domain": "Multi-Stage Non-Root UID 1001 Air-Gapped Container Hardening",
            "install": "skills install docker-expert",
            "keywords": "docker,docker-expert,dockerfile,docker-compose,container,distroless,air-gap,healthcheck,non-root",
        },
        "trpc-fullstack": {
            "domain": "End-to-End Type-Safe tRPC v11 Router & Dual Context Factory",
            "install": "skills install trpc-fullstack",
            "keywords": "trpc,trpc-fullstack,createtrpccontext,createservercontext,publicprocedure,protectedprocedure,zod router",
        },
        "asana-automation": {
            "domain": "Workspace-Scoped Asana GID Discovery & Parallel Subtask Sync",
            "install": "skills install asana-automation",
            "keywords": "asana,asana-automation,workspace gid,subtasks,parallel requests,task sync",
        },
        "audio-transcriber": {
            "domain": "Audio Transcription, Whisper Diarization & Timestamped Subtitles",
            "install": "skills install audio-transcriber",
            "keywords": "audio-transcriber,transcribe audio,diarization,whisper transcript,audio to text",
        },
        "fal-audio": {
            "domain": "Text-to-Speech & Speech-to-Text via fal.ai Audio Models",
            "install": "skills install fal-audio",
            "keywords": "fal-audio,fal audio,fal.ai tts,fal.ai stt",
        },
        "azure-ai-contentunderstanding-py": {
            "domain": "Azure AI Multimodal Content Understanding (Text, Audio, Video, Image)",
            "install": "skills install azure-ai-contentunderstanding-py",
            "keywords": "azure-ai-contentunderstanding-py,content understanding,multimodal extraction",
        },
        "azure-ai-openai-dotnet": {
            "domain": "Azure OpenAI SDK for .NET Chat, Embeddings & Realtime Audio",
            "install": "skills install azure-ai-openai-dotnet",
            "keywords": "azure-ai-openai-dotnet,azure openai dotnet,chatclient csharp",
        },
        "podcast-generation": {
            "domain": "Realtime WebSocket PCM-to-WAV Podcast Narrative Generation",
            "install": "skills install podcast-generation",
            "keywords": "podcast-generation,podcast,gpt-realtime-mini,pcm to wav,audio narrative",
        },
        "videodb": {
            "domain": "Video & Audio Perception, Spoken/Visual Indexing, Search & RTSP Streams",
            "install": "skills install videodb",
            "keywords": "videodb,video index,spoken index,visual search,rtsp stream,desktop perception",
        },
        "videodb-skills": {
            "domain": "VideoDB SDK Upload, HLS Streaming, Subtitles & Multi-Clip Timeline Editing",
            "install": "skills install videodb-skills",
            "keywords": "videodb-skills,video-db,hls stream,subtitle styling,video clip combine",
        },
        "seek-and-analyze-video": {
            "domain": "Timestamped Video Scene Seeking, Frame Extraction & Visual Analysis",
            "install": "skills install seek-and-analyze-video",
            "keywords": "seek-and-analyze-video,seek video,frame extraction,scene analysis",
        },
        "daily-gift": {
            "domain": "Daily Gift & Curated Micro-Delight Interactive Experience Generator",
            "install": "skills install daily-gift",
            "keywords": "daily-gift,daily gift,micro-delight,daily reward",
        },
        "fal-generate": {
            "domain": "Generative Image & Video Synthesis via fal.ai AI Models",
            "install": "skills install fal-generate",
            "keywords": "fal-generate,fal.ai video,fal.ai image,generative media",
        },
        "ingest-youtube": {
            "domain": "YouTube Video Transcript, Chapter & Metadata Ingestion Pipeline",
            "install": "skills install ingest-youtube",
            "keywords": "ingest-youtube,youtube ingest,youtube transcript fetch",
        },
        "remotion-best-practices": {
            "domain": "Programmatic React Video Creation, Captions & 3D Sequencing in Remotion",
            "install": "skills install remotion-best-practices",
            "keywords": "remotion-best-practices,remotion,react video,@remotion/captions,mediabunny",
        },
        "youtube-summarizer": {
            "domain": "Structured YouTube Video Summarization & Timestamped Key Takeaways",
            "install": "skills install youtube-summarizer",
            "keywords": "youtube-summarizer,summarize youtube,video summary,chapter takeaways",
        },
        "youtube-automation": {
            "domain": "End-to-End YouTube Scripting, Thumbnail Briefs, SEO Metadata & Publishing",
            "install": "skills install youtube-automation",
            "keywords": "youtube-automation,youtube channel,youtube seo,video script automation",
        },
        "tiktok-automation": {
            "domain": "Short-Form 9:16 Vertical Video Hooks, Word-Highlight Captions & TikTok Automation",
            "install": "skills install tiktok-automation",
            "keywords": "tiktok-automation,tiktok,vertical video,short-form hook",
        },
        "humanize-chinese": {
            "domain": "Chinese AIGC Detection, De-AI Rewriting, CNKI Academic & Style Transfer",
            "install": "skills install humanize-chinese",
            "keywords": "humanize-chinese,chinese aigc,de-ai chinese,cnki,xiaohongshu,zhihu",
        },
        "employment-contract-templates": {
            "domain": "Jurisdiction-Aware Employment Contract, IP Assignment & NDA Templates",
            "install": "skills install employment-contract-templates",
            "keywords": "employment-contract-templates,employment contract,ip assignment,nda clause",
        },
        "google-antigravity-sdk": {
            "domain": "Google Antigravity Agentic SDK, Tool Bindings & Artifact Surfaces",
            "install": "skills install google-antigravity-sdk",
            "keywords": "google-antigravity-sdk,antigravity sdk,agentic sdk",
        },
        "voice-agents": {
            "domain": "Sub-800ms Speech-to-Speech & STT-LLM-TTS Voice Agent Architecture",
            "install": "skills install voice-agents",
            "keywords": "voice-agents,voice agent,speech-to-speech,sub-800ms,turn-taking,barge-in",
        },
        "voice-ai-development": {
            "domain": "Real-Time Voice AI Pipeline, Silero VAD & Conversational Flow",
            "install": "skills install voice-ai-development",
            "keywords": "voice-ai-development,voice ai,silero vad,conversational voice",
        },
        "voice-ai-engine-development": {
            "domain": "Low-Latency Audio DSP, Streaming TTS/STT & Voice Engine Core",
            "install": "skills install voice-ai-engine-development",
            "keywords": "voice-ai-engine-development,voice engine,audio dsp,streaming tts",
        },
        "azure-ai-voicelive-dotnet": {
            "domain": "Azure AI VoiceLive Bidirectional WebSocket SDK for .NET",
            "install": "skills install azure-ai-voicelive-dotnet",
            "keywords": "azure-ai-voicelive-dotnet,voicelive dotnet",
        },
        "azure-ai-voicelive-java": {
            "domain": "Azure AI VoiceLive Bidirectional WebSocket SDK for Java",
            "install": "skills install azure-ai-voicelive-java",
            "keywords": "azure-ai-voicelive-java,voicelive java",
        },
        "azure-ai-voicelive-py": {
            "domain": "Azure AI VoiceLive Bidirectional WebSocket SDK for Python",
            "install": "skills install azure-ai-voicelive-py",
            "keywords": "azure-ai-voicelive-py,voicelive python,azure.ai.voicelive",
        },
        "azure-ai-voicelive-ts": {
            "domain": "Azure AI VoiceLive Bidirectional WebSocket SDK for TypeScript",
            "install": "skills install azure-ai-voicelive-ts",
            "keywords": "azure-ai-voicelive-ts,voicelive typescript,voicelive ts",
        },
        "agentphone": {
            "domain": "Autonomous Telephony, SIP/PSTN Voice Calls & AgentPhone Dispatch",
            "install": "skills install agentphone",
            "keywords": "agentphone,sip call,pstn voice,phone agent",
        },
        "ux-copy": {
            "domain": "High-Clarity UX Microcopy, CTA Precision & Error Recovery Messaging",
            "install": "skills install ux-copy",
            "keywords": "ux-copy,microcopy,cta copy,error message copy",
        },
        "professional-proofreader": {
            "domain": "Publication-Grade Proofreading, Grammar, Syntax & Tone Calibration",
            "install": "skills install professional-proofreader",
            "keywords": "professional-proofreader,proofread,proofreader,copy editing,grammar check",
        },
        "pipecat-friday-agent": {
            "domain": "Pipecat Multimodal Friday Voice Assistant & Frame Processor Pipeline",
            "install": "skills install pipecat-friday-agent",
            "keywords": "pipecat-friday-agent,pipecat,friday agent,frame processor",
        },
        "github-issue-creator": {
            "domain": "Structured Reproducible GitHub Issue & Acceptance Criteria Generator",
            "install": "skills install github-issue-creator",
            "keywords": "github-issue-creator,github issue,bug report template",
        },
        "earllm-build": {
            "domain": "EarLLM Audio-First Cognitive Pipeline & Acoustic Prompt Compilation",
            "install": "skills install earllm-build",
            "keywords": "earllm-build,earllm,acoustic prompt,audio cognitive",
        },
        "content-creator": {
            "domain": "Brand Voice Analysis, SEO Content Frameworks & Multi-Platform Publishing",
            "install": "skills install content-creator",
            "keywords": "content-creator,brand voice,content framework,editorial calendar",
        },
        "azure-ai-contentsafety-py": {
            "domain": "Azure AI Content Safety Text/Image Harm & Blocklist Filtering",
            "install": "skills install azure-ai-contentsafety-py",
            "keywords": "azure-ai-contentsafety-py,content safety,harm filter,blocklist",
        },
        "azure-ai-vision-imageanalysis-java": {
            "domain": "Azure AI Vision Image Analysis, Read OCR & Smart Cropping for Java",
            "install": "skills install azure-ai-vision-imageanalysis-java",
            "keywords": "azure-ai-vision-imageanalysis-java,vision imageanalysis java,smart crop",
        },
        "agents-v2-py": {
            "domain": "Modular Multi-Agent v2 Python Orchestration & Handoff Protocol",
            "install": "skills install agents-v2-py",
            "keywords": "agents-v2-py,agents v2,python multi-agent",
        },
        "threejs-textures": {
            "domain": "Three.js PBR Materials, UV Mapping, KTX2 Compression & Procedural Textures",
            "install": "skills install threejs-textures",
            "keywords": "threejs-textures,pbr texture,ktx2,roughness map,normal map",
        },
        "azure-containerregistry-py": {
            "domain": "Azure Container Registry OCI Artifact & Image Lifecycle SDK",
            "install": "skills install azure-containerregistry-py",
            "keywords": "azure-containerregistry-py,acr sdk,container registry",
        },
        "azure-ai-translation-text-py": {
            "domain": "Azure AI Multilanguage Text Translation, Transliteration & Dictionary Lookup",
            "install": "skills install azure-ai-translation-text-py",
            "keywords": "azure-ai-translation-text-py,text translation,multilanguage,transliterate",
        },
        "aomi-transact": {
            "domain": "Deterministic Financial & On-Chain Transaction Safety Verification",
            "install": "skills install aomi-transact",
            "keywords": "aomi-transact,transaction safety,atomic settlement",
        },
        "azure-ai-transcription-py": {
            "domain": "Azure AI Batch & Real-Time Speech Transcription with Speaker Diarization",
            "install": "skills install azure-ai-transcription-py",
            "keywords": "azure-ai-transcription-py,azure transcription,batch speech to text",
        },
        "azure-ai-translation-document-py": {
            "domain": "Azure AI Asynchronous Batch Document Translation Preserving Layout",
            "install": "skills install azure-ai-translation-document-py",
            "keywords": "azure-ai-translation-document-py,document translation,translate pdf docx",
        },
        "bigquery-data-transfer-service": {
            "domain": "BigQuery Data Transfer Service Scheduling & Cross-Cloud Ingestion",
            "install": "skills install bigquery-data-transfer-service",
            "keywords": "bigquery-data-transfer-service,bigquery transfer,bq dts",
        },
        "alphagenome-single-variant-analysis": {
            "domain": "AlphaGenome Single-Variant Regulatory & Splicing Impact Scoring",
            "install": "skills install alphagenome-single-variant-analysis",
            "keywords": "alphagenome-single-variant-analysis,alphagenome_single_variant_analysis,alphagenome,variant splicing",
        },
        "jaspar-database": {
            "domain": "JASPAR Transcription Factor Binding Profile & Position Weight Matrix Query",
            "install": "skills install jaspar-database",
            "keywords": "jaspar-database,jaspar_database,jaspar,transcription factor motif,pwm",
        },
        "modern-web-guidance": {
            "domain": "Modern Web Platform APIs, View Transitions, Baseline CSS & Core Vitals",
            "install": "skills install modern-web-guidance",
            "keywords": "modern-web-guidance,view transitions,baseline web,container queries",
        },
        "ensembl-database": {
            "domain": "Ensembl Genomic Coordinates, VEP Variant Annotation & Ortholog Lookup",
            "install": "skills install ensembl-database",
            "keywords": "ensembl-database,ensembl_database,ensembl,vep annotation,genomic coordinates",
        },
        "azure-ai-textanalytics-py": {
            "domain": "Azure AI Language Sentiment, Key Phrase Extraction, NER & PII Redaction",
            "install": "skills install azure-ai-textanalytics-py",
            "keywords": "azure-ai-textanalytics-py,text analytics,pii redaction,entity recognition",
        },
        "azure-speech-to-text-rest-py": {
            "domain": "Azure Speech-to-Text REST Short-Audio & Pronunciation Assessment",
            "install": "skills install azure-speech-to-text-rest-py",
            "keywords": "azure-speech-to-text-rest-py,speech rest api,pronunciation assessment",
        },
        "ad-creative": {
            "domain": "High-Converting Ad Creative Variations, Headlines & Visual Briefs",
            "install": "skills install ad-creative",
            "keywords": "ad-creative,ad copy,creative variations,roas creative",
        },
        "code-reviewer": {
            "domain": "AI-Assisted Static Analysis, OWASP Security & Performance Code Review",
            "install": "skills install code-reviewer",
            "keywords": "code-reviewer,code review,static analysis,sonarqube,semgrep",
        },
        "ux-audit": {
            "domain": "Heuristic UX Audit, Cognitive Load Reduction & Conversion Diagnostics",
            "install": "skills install ux-audit",
            "keywords": "ux-audit,heuristic evaluation,usability audit,funnel friction",
        },
        "uxui-principles": {
            "domain": "Foundational Visual Hierarchy, Typography, Grid Systems & Interaction Laws",
            "install": "skills install uxui-principles",
            "keywords": "uxui-principles,fitts law,hicks law,visual hierarchy,gestalt",
        },
        "shadcn": {
            "domain": "Accessible Radix + Tailwind CSS shadcn/ui Component Composition",
            "install": "skills install shadcn",
            "keywords": "shadcn,shadcn/ui,radix primitives,cva variants",
        },
        "python-performance-optimization": {
            "domain": "cProfile, Vectorization, AsyncIO, Memory Slots & Cython/PyPy Tuning",
            "install": "skills install python-performance-optimization",
            "keywords": "python-performance-optimization,cprofile,__slots__,vectorize python",
        },
        "boost": {
            "domain": "Execution Velocity Boost, Hot-Path Optimization & Zero-Overhead Compilation",
            "install": "skills install boost",
            "keywords": "boost,velocity boost,hot-path optimization",
        },
        "readme": {
            "domain": "High-Impact Open-Source README Architecture, Badges & Quickstart Docs",
            "install": "skills install readme",
            "keywords": "readme,readme.md,project overview,quickstart guide",
        },
        "hugging-face-papers": {
            "domain": "Hugging Face Daily Papers & arXiv Markdown/Metadata API Synthesis",
            "install": "skills install hugging-face-papers",
            "keywords": "hugging-face-papers,hf.co/papers,huggingface papers,daily papers",
        },
        "cqrs-implementation": {
            "domain": "Command Query Responsibility Segregation & Event-Sourced Read Projections",
            "install": "skills install cqrs-implementation",
            "keywords": "cqrs-implementation,cqrs,command query,event sourcing,read projection",
        },
        "gcp-spark": {
            "domain": "Google Cloud Dataproc Serverless Spark Tuning, Partitioning & Shuffle Optimization",
            "install": "skills install gcp-spark",
            "keywords": "gcp-spark,dataproc,pyspark tuning,aqe shuffle",
        },
        "documentation": {
            "domain": "Diataxis Technical Documentation: Tutorials, How-To, Reference & Explanation",
            "install": "skills install documentation",
            "keywords": "documentation,diataxis,technical docs,api reference",
        },
        "doc-coauthoring": {
            "domain": "Structured Collaborative Document Co-Authoring & Iterative Section Refinement",
            "install": "skills install doc-coauthoring",
            "keywords": "doc-coauthoring,coauthor document,collaborative spec,rfc drafting",
        },
        "magic-ui-generator": {
            "domain": "Animated Bento Grids, Marquees, Shimmer Buttons & Magic UI Components",
            "install": "skills install magic-ui-generator",
            "keywords": "magic-ui-generator,magic ui,bento marquee,shimmer button",
        },
        "local-llm-expert": {
            "domain": "Quantized GGUF/EXL2 Local LLM Inference, Ollama/vLLM/llama.cpp & Apple Metal",
            "install": "skills install local-llm-expert",
            "keywords": "local-llm-expert,local llm,gguf,ollama,llama.cpp,vllm,mlx",
        },
        "rag-engineer": {
            "domain": "Hybrid Chunking, Cross-Encoder Reranking, HyDE & Grounded RAG Architecture",
            "install": "skills install rag-engineer",
            "keywords": "rag-engineer,hybrid rag,reranker,hyde,semantic chunking",
        },
        "prompt-caching": {
            "domain": "Prefix KV-Cache Alignment, Static-First Ordering & 90% Latency/Cost Reduction",
            "install": "skills install prompt-caching",
            "keywords": "prompt-caching,kv cache,prefix cache,cache_control,ephemeral cache",
        },
        "prompt-engineering-patterns": {
            "domain": "Few-Shot Curriculum, Delimiter Isolation, CoT & Schema-Guided Output",
            "install": "skills install prompt-engineering-patterns",
            "keywords": "prompt-engineering-patterns,few-shot,chain of thought,xml delimiters",
        },
        "hugging-face-evaluation": {
            "domain": "Deterministic Model Benchmarking via Lighteval, Inspect-AI & vLLM Harnesses",
            "install": "skills install hugging-face-evaluation",
            "keywords": "hugging-face-evaluation,lighteval,inspect-ai,model evaluation",
        },
        "llm-application-dev-prompt-optimize": {
            "domain": "Iterative Prompt Compression, Token Budgeting & Ablation Testing",
            "install": "skills install llm-application-dev-prompt-optimize",
            "keywords": "llm-application-dev-prompt-optimize,prompt optimize,token budget ablation",
        },
        "llm-application-dev-langchain-agent": {
            "domain": "LangChain/LangGraph StateGraph Tool-Calling Agent & Memory Checkpointing",
            "install": "skills install llm-application-dev-langchain-agent",
            "keywords": "llm-application-dev-langchain-agent,langchain agent,langgraph,stategraph",
        },
    }

    SPE_V4_REQUIRED_SKILLS: Tuple[str, ...] = (
        "using-superpowers",
        "product-design",
        "performance-engineer",
        "frontend-mobile-development-component-scaffold",
        "progressive-web-app",
        "deep-research",
        "seo",
        "antigravity-design-expert",
        "design-taste-frontend",
        "error-diagnostics-error-trace",
        "competitor-alternatives",
        "docker-expert",
        "trpc-fullstack",
        "antigravity-skill-orchestrator",
        "asana-automation",
    )

    SPE_V5_REQUIRED_SKILLS: Tuple[str, ...] = (
        "audio-transcriber",
        "fal-audio",
        "azure-ai-contentunderstanding-py",
        "azure-ai-openai-dotnet",
        "podcast-generation",
        "videodb",
        "videodb-skills",
        "seek-and-analyze-video",
        "daily-gift",
        "fal-generate",
        "ingest-youtube",
        "remotion-best-practices",
        "youtube-summarizer",
        "youtube-automation",
        "tiktok-automation",
        "humanize-chinese",
        "employment-contract-templates",
        "using-superpowers",
        "antigravity-skill-orchestrator",
        "google-antigravity-sdk",
        "voice-agents",
        "voice-ai-development",
        "voice-ai-engine-development",
        "azure-ai-voicelive-dotnet",
        "azure-ai-voicelive-java",
        "azure-ai-voicelive-py",
        "azure-ai-voicelive-ts",
        "agentphone",
        "ux-copy",
        "professional-proofreader",
        "pipecat-friday-agent",
        "github-issue-creator",
        "earllm-build",
        "content-creator",
        "azure-ai-contentsafety-py",
        "azure-ai-vision-imageanalysis-java",
        "agents-v2-py",
        "threejs-textures",
        "azure-containerregistry-py",
        "azure-ai-translation-text-py",
        "aomi-transact",
        "azure-ai-transcription-py",
        "azure-ai-translation-document-py",
        "bigquery-data-transfer-service",
        "alphagenome-single-variant-analysis",
        "jaspar-database",
        "modern-web-guidance",
        "ensembl-database",
        "azure-ai-textanalytics-py",
        "azure-speech-to-text-rest-py",
        "ad-creative",
        "code-reviewer",
        "ux-audit",
        "uxui-principles",
        "shadcn",
        "python-performance-optimization",
        "boost",
        "readme",
        "hugging-face-papers",
        "cqrs-implementation",
        "gcp-spark",
        "deep-research",
        "documentation",
        "doc-coauthoring",
        "magic-ui-generator",
        "local-llm-expert",
        "rag-engineer",
        "prompt-caching",
        "prompt-engineering-patterns",
        "hugging-face-evaluation",
        "llm-application-dev-prompt-optimize",
        "llm-application-dev-langchain-agent",
    )

    # Malicious patterns to reject during skill qualification
    MALICIOUS_PATTERNS = [
        re.compile(r"curl\s+.*\|\s*(?:bash|sh)", re.IGNORECASE),
        re.compile(r"wget\s+.*\|\s*(?:bash|sh)", re.IGNORECASE),
        re.compile(r"rm\s+-rf\s+/(?:\s|$)", re.IGNORECASE),
        re.compile(r"(?:api_key|password|secret|token)\s*=\s*['\"][^'\"]+['\"].*http", re.IGNORECASE),
        re.compile(r"requests\.post\(.*(?:evil|webhook|collect|exfil)", re.IGNORECASE),
    ]

    def __init__(self, local_installed_skills: Optional[Set[str]] = None):
        # Default installed skills from current environment if not passed
        self.installed_skills = local_installed_skills or {
            "frontend-design",
            "systematic-debugging",
            "tdd-workflow",
            "security-auditor",
            "writing-plans",
            "github",
            "jq",
            "recallmax",
            *self.SPE_V4_REQUIRED_SKILLS,
            *self.SPE_V5_REQUIRED_SKILLS,
        }

    def detect_required_skills(self, task_description: str, files_modified: Optional[List[str]] = None) -> List[SkillRequirement]:
        """
        Analyzes task intent and file extensions to detect necessary specialized skills.
        """
        text = task_description.lower()
        files = files_modified or []
        files_text = " ".join(files).lower()
        full_context = f"{text} {files_text}"
        normalized_context = full_context.replace("_", "-")

        requirements: List[SkillRequirement] = []
        matched_skills: Set[str] = set()

        for skill_name, meta in self.KNOWN_SKILL_REGISTRY.items():
            skill_low = skill_name.lower()
            if re.search(rf"\b{re.escape(skill_low)}\b", full_context) or re.search(rf"\b{re.escape(skill_low)}\b", normalized_context):
                matched_skills.add(skill_name)
                continue
            keywords = meta["keywords"].split(",")
            if any(re.search(rf"\b{re.escape(k.strip())}\b", full_context) for k in keywords if k.strip()):
                matched_skills.add(skill_name)

        # File-specific heuristics
        if any(f.endswith((".tsx", ".jsx", ".css", ".html")) for f in files):
            matched_skills.add("frontend-design")
        if any("test" in f or f.endswith((".spec.ts", ".test.ts", "_test.py", "test_.py")) for f in files):
            matched_skills.add("tdd-workflow")
        if any("auth" in f or "secret" in f for f in files):
            matched_skills.add("security-auditor")

        # Compile requirements
        for s in sorted(matched_skills):
            meta = self.KNOWN_SKILL_REGISTRY[s]
            is_installed = s in self.installed_skills
            requirements.append(
                SkillRequirement(
                    skill_name=s,
                    domain=meta["domain"],
                    is_installed=is_installed,
                    install_command=meta["install"],
                    security_verdict="SAFE",
                    rationale=f"Task involves {meta['domain'].lower()}",
                )
            )

        # If none matched, default to systematic-debugging and tdd-workflow
        if not requirements:
            requirements.append(
                SkillRequirement(
                    skill_name="systematic-debugging",
                    domain="Error Diagnosis & Bug Fixing",
                    is_installed="systematic-debugging" in self.installed_skills,
                    install_command=self.KNOWN_SKILL_REGISTRY["systematic-debugging"]["install"],
                    security_verdict="SAFE",
                    rationale="General defect-free execution",
                )
            )

        return requirements

    def audit_skill_safety(self, skill_content: str) -> Tuple[bool, str]:
        """
        Performs static security analysis on prospective skill scripts/instructions.
        Rejects arbitrary bash pipes, dangerous deletes, and network exfiltration.
        """
        for pattern in self.MALICIOUS_PATTERNS:
            if pattern.search(skill_content):
                return False, f"REJECTED: Malicious pattern detected ({pattern.pattern})"
        return True, "PASSED_SAFE"

    def formulate_installation_proposal(
        self,
        task_description: str,
        files_modified: Optional[List[str]] = None,
        skill_payloads_to_audit: Optional[Dict[str, str]] = None
    ) -> SkillInstallationProposal:
        """
        Synthesizes a complete skill binding proposal for task compilation.
        """
        requirements = self.detect_required_skills(task_description, files_modified)
        missing: List[SkillRequirement] = []
        headers: List[str] = []
        is_all_safe = True

        for req in requirements:
            if not req.is_installed:
                # Audit payload if provided
                if skill_payloads_to_audit and req.skill_name in skill_payloads_to_audit:
                    safe, msg = self.audit_skill_safety(skill_payloads_to_audit[req.skill_name])
                    if not safe:
                        is_all_safe = False
                        req = SkillRequirement(
                            skill_name=req.skill_name,
                            domain=req.domain,
                            is_installed=False,
                            install_command=req.install_command,
                            security_verdict="REJECTED",
                            rationale=msg,
                        )
                missing.append(req)

            # Build prompt directive header
            headers.append(f"- `@skill:{req.skill_name}` ({req.domain})")

        return SkillInstallationProposal(
            required_skills=requirements,
            missing_skills=missing,
            injected_prompt_headers=headers,
            is_safe=is_all_safe,
        )

    def auto_install_skill(self, skill_name: str) -> bool:
        """
        Simulates safe dynamic installation into the agent environment.
        """
        if skill_name in self.KNOWN_SKILL_REGISTRY:
            self.installed_skills.add(skill_name)
            return True
        return False

    def install_skill_to_disk(self, skill_name: str, target_dir: Optional[str] = None) -> Tuple[bool, str]:
        """
        Physically scaffolds and writes the verified SKILL.md to disk.
        Default target: .spe/skills/<skill_name>/SKILL.md
        """
        from pathlib import Path

        if skill_name not in self.KNOWN_SKILL_REGISTRY:
            return False, f"Unknown skill: {skill_name}"

        meta = self.KNOWN_SKILL_REGISTRY[skill_name]
        out_base = Path(target_dir) if target_dir else Path(".spe/skills")
        skill_dir = out_base / skill_name
        skill_dir.mkdir(parents=True, exist_ok=True)
        skill_file = skill_dir / "SKILL.md"

        content = (
            f"---\n"
            f"name: {skill_name}\n"
            f"description: \"{meta['domain']}\"\n"
            f"version: 1.0.0\n"
            f"verified_by: SPE_OMEGA_AUTONOMOUS_SKILL_AUTHORITY\n"
            f"---\n\n"
            f"# {meta['domain']}: {skill_name}\n\n"
            f"## Operational Directives\n"
            f"- Apply verified domain invariants for {meta['domain'].lower()}.\n"
            f"- Strictly enforce safety and avoid ad-hoc heuristic workarounds.\n"
            f"- Maintain complete documentation and test integrity.\n"
        )

        safe, msg = self.audit_skill_safety(content)
        if not safe:
            return False, msg

        skill_file.write_text(content, encoding="utf-8")
        self.installed_skills.add(skill_name)
        return True, str(skill_file)
