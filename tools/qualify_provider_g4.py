#!/usr/bin/env python3
"""Validate ABI claim names offline; optionally probe OpenAI once using an env-only key.

Usage: qualify_provider_g4.py offline|live provider.json [endpoint] [model]
A passing probe is not evidence of full ABI/provider conformance.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / 'schemas/spe_universal_abi.schema.json'
ENDPOINT = 'https://api.openai.com/v1/chat/completions'
MAX_BODY = 65536

class QualificationError(Exception):
    def __init__(self, code, reason):
        super().__init__(f'{code}: {reason}')
        self.code = code


def load_provider(path):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, ValueError, UnicodeError):
        raise QualificationError('BAD_PROVIDER_FILE', 'unreadable or invalid JSON') from None


def validate_offline(provider):
    if not isinstance(provider, dict):
        raise QualificationError('BAD_PROVIDER_FILE', 'expected an object')
    impl = provider.get('implementation_id')
    if not isinstance(impl, str) or not impl.strip():
        raise QualificationError('NO_IMPLEMENTATION_ID', 'nonempty string required')
    claims = provider.get('capabilities')
    if not isinstance(claims, list) or not claims:
        raise QualificationError('NO_CAPABILITIES', 'nonempty list required')
    if not all(isinstance(c, str) for c in claims):
        raise QualificationError('BAD_CAPABILITY', 'claims must be strings')
    if len(set(claims)) != len(claims):
        raise QualificationError('DUPLICATE_CAPABILITY', 'claims must be unique')
    try:
        allowed = json.loads(SCHEMA.read_text())['properties']['capabilities']['items']['enum']
        if not isinstance(allowed, list) or not allowed or not all(isinstance(c, str) for c in allowed):
            raise ValueError()
    except (OSError, ValueError, KeyError, TypeError):
        raise QualificationError('BAD_ABI_SCHEMA', 'cannot read capability enum') from None
    if any(c not in allowed for c in claims):
        raise QualificationError('CAPABILITY_NOT_IN_ABI', 'unknown capability refused')
    return claims


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward the authorization header to another endpoint.


def probe_live(endpoint_url, api_key, model):
    if endpoint_url != ENDPOINT:
        raise QualificationError('ENDPOINT_NOT_ALLOWED', 'this probe supports the exact OpenAI endpoint only')
    if not isinstance(model, str) or not model.strip() or len(model) > 200:
        raise QualificationError('BAD_MODEL', 'a model name is required')
    if not isinstance(api_key, str) or not api_key or any(c in api_key for c in '\r\n'):
        raise QualificationError('NO_API_KEY', 'set an API key in the environment')
    payload = json.dumps({'model': model, 'messages': [{'role':'user','content':'Reply with the single word: ACK'}], 'max_tokens':4}).encode()
    req = urllib.request.Request(endpoint_url, data=payload, headers={'Content-Type':'application/json','Authorization':'Bearer '+api_key})
    started = time.monotonic()
    body = b''
    status = None
    failure = None
    provider_error_code = None
    provider_error_type = None
    body_truncated = False
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=30) as response:
            status = response.status
            body = response.read(MAX_BODY + 1)
        if len(body) > MAX_BODY:
            failure = 'RESPONSE_TOO_LARGE'
        elif status != 200:
            failure = 'HTTP_ERROR'
        else:
            try:
                content = json.loads(body)['choices'][0]['message']['content']
                if not isinstance(content, str) or content.strip() != 'ACK':
                    failure = 'UNEXPECTED_RESPONSE'
            except (ValueError, KeyError, IndexError, TypeError):
                failure = 'INVALID_RESPONSE'
    except urllib.error.HTTPError as exc:
        status = exc.code
        failure = 'HTTP_ERROR'
        try:
            body = exc.read(MAX_BODY + 1)
            body_truncated = len(body) > MAX_BODY
            if body_truncated:
                body = body[:MAX_BODY]
            else:
                error = json.loads(body).get('error', {})
                # Only known enum values are emitted; never echo free-form provider text.
                known = {'insufficient_quota', 'rate_limit_exceeded', 'rate_limit_error',
                         'slow_down', 'billing_not_active', 'billing_hard_limit_reached',
                         'organization_spend_limit_exceeded', 'organization_usage_limit_exceeded',
                         'invalid_api_key', 'invalid_request_error', 'tokens', 'requests'}
                if isinstance(error, dict):
                    code, kind = error.get('code'), error.get('type')
                    provider_error_code = code if isinstance(code, str) and code in known else None
                    provider_error_type = kind if isinstance(kind, str) and kind in known else None
        except (OSError, ValueError, AttributeError, TypeError):
            pass
        finally:
            exc.close()
    except (urllib.error.URLError, OSError, ValueError):
        failure = 'NETWORK_ERROR'  # Do not echo exception text or provider error bodies.
    return {'checked':'minimal_ack_probe_only', 'endpoint':endpoint_url, 'model':model,
            'http_status':status, 'latency_ms':int((time.monotonic()-started)*1000),
            'response_sha256':hashlib.sha256(body).hexdigest() if body else None,
            'verdict':'FAIL' if failure else 'PASS', 'failure_code':failure,
            'provider_error_code':provider_error_code, 'provider_error_type':provider_error_type,
            'response_body_truncated':body_truncated}


def write_receipt(path, provider, phase, result):
    receipt = {'created_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'implementation_id':provider['implementation_id'], 'phase':phase,
               'claims':provider['capabilities'], 'result':result,
               'scope':'Claim-name validation and one response only; no full ABI conformance asserted.'}
    path.parent.mkdir(parents=True, exist_ok=True)
    # Avoid overwriting an existing symlink or shared receipt. Owner-readable only.
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w', encoding='utf-8') as f:
        json.dump(receipt, f, indent=2, sort_keys=True)
        f.write('\n')
    return receipt


def main(argv=None):
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) < 2 or args[0] not in ('offline','live'):
        print(__doc__, file=sys.stderr)
        return 2
    try:
        phase, path = args[:2]
        if (phase == 'offline' and len(args) != 2) or (phase == 'live' and len(args) not in (3,4)):
            raise QualificationError('BAD_ARGUMENTS', 'unexpected argument count')
        provider = load_provider(path)
        claims = validate_offline(provider)
        if phase == 'offline':
            result = {'checked':'claim_names_against_repository_abi_enum', 'claims':claims, 'verdict':'PASS'}
        else:
            key = os.environ.get('SPE_PROVIDER_KEY') or os.environ.get('OPENAI_API_KEY')
            if not key:
                raise QualificationError('NO_API_KEY', 'set an API key in the environment')
            # Prevent user-controlled manifest fields from copying the credential into receipts.
            if key in json.dumps(provider) or any(key in a for a in args):
                raise QualificationError('SECRET_IN_INPUT', 'credential must appear only in the environment')
            result = probe_live(args[2], key, args[3] if len(args)==4 else provider.get('model','gpt-4o-mini'))
        import uuid
        write_receipt(ROOT/'qualification'/f'{uuid.uuid4().hex}_{phase}_receipt.json',provider,phase,result)
        print(json.dumps(result, sort_keys=True))
        return 0 if result['verdict']=='PASS' else 1
    except QualificationError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except OSError:
        print('RECEIPT_WRITE_ERROR: cannot persist qualification evidence', file=sys.stderr)
        return 1

if __name__ == '__main__':
    sys.exit(main())
