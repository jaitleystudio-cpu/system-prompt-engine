import json
from dataclasses import asdict
from spe_runtime.research.rgic_e1.types import EvidenceClosureContract

class PortableContract:
    @staticmethod
    def serialize(contract: EvidenceClosureContract) -> str:
        # Simplified RFC 8785: compact json with sorted keys
        d = asdict(contract)
        # Convert enums
        for obs in d['obligations']:
            obs['state'] = obs['state'].value
        d['claim_scope'] = d['claim_scope'].value
        
        return json.dumps(d, separators=(',', ':'), sort_keys=True)
