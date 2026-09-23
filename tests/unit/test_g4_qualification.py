"""Deterministic G4 checks. No test makes an external request."""
import importlib.util
import json
from pathlib import Path
import urllib.error
import pytest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('g4', ROOT/'tools/qualify_provider_g4.py')
g4 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g4)

def provider(caps=None):
    return {'implementation_id':'provider.test', 'capabilities':caps if caps is not None else ['CORE_CONTRACT']}

@pytest.mark.parametrize('caps,code', [(['TELEPORTATION'],'CAPABILITY_NOT_IN_ABI'), (['CORE_CONTRACT']*2,'DUPLICATE_CAPABILITY'), ([], 'NO_CAPABILITIES'), ([{}], 'BAD_CAPABILITY')])
def test_invalid_claims(caps,code):
    with pytest.raises(g4.QualificationError, match=code):
        g4.validate_offline(provider(caps))

def test_enum_is_read_from_schema(tmp_path,monkeypatch):
    p=tmp_path/'schema.json'
    p.write_text(json.dumps({'properties':{'capabilities':{'items':{'enum':['TEST_ONLY']}}}}))
    monkeypatch.setattr(g4,'SCHEMA',p)
    assert g4.validate_offline(provider(['TEST_ONLY'])) == ['TEST_ONLY']
    with pytest.raises(g4.QualificationError): g4.validate_offline(provider())

@pytest.mark.parametrize('value',[None,[],{'implementation_id':42,'capabilities':['CORE_CONTRACT']}])
def test_bad_manifest(value):
    with pytest.raises(g4.QualificationError): g4.validate_offline(value)

def test_requires_env_key(tmp_path,monkeypatch,capsys):
    p=tmp_path/'provider.json'; p.write_text(json.dumps(provider()))
    monkeypatch.delenv('SPE_PROVIDER_KEY',raising=False)
    monkeypatch.delenv('OPENAI_API_KEY',raising=False)
    assert g4.main(['live',str(p),g4.ENDPOINT]) == 1
    assert 'NO_API_KEY' in capsys.readouterr().err

class Response:
    status=200
    def __init__(self,body): self.body=body
    def __enter__(self): return self
    def __exit__(self,*args): pass
    def read(self,limit): return self.body[:limit]

@pytest.mark.parametrize('body,verdict',[(b'{"choices":[{"message":{"content":"ACK"}}]}','PASS'),(b'{}','FAIL'),(b'not json','FAIL'),(b'x'*65537,'FAIL'),(b'{"choices":[{"message":{"content":"no"}}]}','FAIL')])
def test_response_validation(body,verdict,monkeypatch):
    class Opener:
        def open(self,req,timeout): return Response(body)
    monkeypatch.setattr(g4.urllib.request,'build_opener',lambda *args:Opener())
    assert g4.probe_live(g4.ENDPOINT,'test-secret','test-model')['verdict']==verdict

def test_bad_key_fails_closed_without_network(monkeypatch):
    class Opener:
        def open(self,req,timeout): raise urllib.error.HTTPError(g4.ENDPOINT,401,'secret',{},None)
    monkeypatch.setattr(g4.urllib.request,'build_opener',lambda *args:Opener())
    result=g4.probe_live(g4.ENDPOINT,'test-secret','test-model')
    assert result['verdict']=='FAIL' and result['http_status']==401
    assert 'secret' not in json.dumps(result)

def test_endpoint_and_redirect_refusal():
    with pytest.raises(g4.QualificationError,match='ENDPOINT_NOT_ALLOWED'):
        g4.probe_live('http://example.org','secret','model')
    assert g4.NoRedirect().redirect_request(None,None,302,'',{},'https://other.invalid') is None

def test_receipt_is_real_and_ignored_location(tmp_path,monkeypatch,capsys):
    p=tmp_path/'provider.json'; p.write_text(json.dumps(provider()))
    monkeypatch.setattr(g4,'ROOT',tmp_path)
    monkeypatch.setenv('SPE_PROVIDER_KEY','test-secret')
    assert g4.main(['offline',str(p)])==0
    receipts=list((tmp_path/'qualification').glob('*_receipt.json'))
    assert len(receipts)==1
    receipt=receipts[0].read_text()
    assert json.loads(receipt)['result']['verdict']=='PASS'
    assert 'test-secret' not in receipt+capsys.readouterr().out
    assert receipts[0].stat().st_mode & 0o777 == 0o600
