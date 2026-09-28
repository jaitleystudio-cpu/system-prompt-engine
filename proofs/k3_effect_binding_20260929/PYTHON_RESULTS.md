# Python results

`python3 -m pytest -q --tb=line` after the package was installed editable so subprocess benchmarks can import `spe_runtime`.

passed: 900
failed: 0

A first run without that install failed two context-protocol benchmark subprocesses with `ModuleNotFoundError: spe_runtime`. Those tests passed in the 900 after install. They do not exercise the effect binder.
