cd /Volumes/4TB-WD/spe-worktrees/spe-agi-brain-r2
python3 -m spe_runtime.research.agi_brain.p4_ollama spe evidence/agi-brain/p4/spe 100000 > evidence/agi-brain/p4/spe_stdout.txt 2>&1
python3 -m spe_runtime.research.agi_brain.p4_ollama baseline evidence/agi-brain/p4/baseline 100000 > evidence/agi-brain/p4/baseline_stdout.txt 2>&1
echo P4DONE > evidence/agi-brain/p4/DONE
