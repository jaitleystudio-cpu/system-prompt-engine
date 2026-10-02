"""Offline static website generator.

Compiles a versioned WebsiteSpec to HTML and CSS files.
It does not call a model, start a sandbox, or host a site.
"""

from website_generator.capabilities import CapabilityHold, hosted_export, sandbox_preview
from website_generator.compiler import SiteArtifact, StaticFile, compile_site, write_static
from website_generator.errors import StaticWriteError, WebsiteSpecError
from website_generator.spec import SPEC_VERSION, WebsiteSpec, parse_spec

__all__ = [
    "SPEC_VERSION",
    "CapabilityHold",
    "SiteArtifact",
    "StaticFile",
    "StaticWriteError",
    "WebsiteSpec",
    "WebsiteSpecError",
    "compile_site",
    "hosted_export",
    "parse_spec",
    "sandbox_preview",
    "write_static",
]
