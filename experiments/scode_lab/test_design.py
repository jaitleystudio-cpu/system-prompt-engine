"""Synthetic fixture only: tests the combinatorial model, not AI fault accuracy."""

import unittest

from experiments.scode_lab.design import (
    Undiagnosable, Witness, compile_witnesses, compatible_faults,
    min_diagnostic_distance, next_probe,
)


class SCodeLabTests(unittest.TestCase):
    def setUp(self):
        self.faults = ("stale_source", "wrong_tool", "lost_constraint")
        self.witnesses = (
            Witness("source_time", 1, frozenset(("stale_source",))),
            Witness("tool_log", 1, frozenset(("wrong_tool",))),
            Witness("intent_map", 1, frozenset(("lost_constraint",))),
            Witness("broad_check", 10, frozenset(self.faults)),
        )

    def test_compiles_checks_before_observation_with_required_distance(self):
        design = compile_witnesses(self.faults, self.witnesses, required_distance=2)
        # The no-fault signature also needs distance 2, so the broad check
        # provides a second detection bit for each fault.
        self.assertEqual(design.cost, 13)
        self.assertEqual({w.name for w in design.selected},
                         {"source_time", "tool_log", "intent_map", "broad_check"})
        self.assertEqual(min_diagnostic_distance(self.faults, design.selected), 2)

    def test_inadequate_witnesses_fail_closed(self):
        with self.assertRaises(Undiagnosable):
            compile_witnesses(self.faults, self.witnesses[:1])

    def test_unknown_does_not_count_as_negative(self):
        observations = {"source_time": None, "tool_log": False}
        self.assertEqual(compatible_faults(self.faults, observations, self.witnesses),
                         ("stale_source", "lost_constraint"))

    def test_probe_separates_ambiguity_by_information_per_cost(self):
        probe = next_probe(("stale_source", "lost_constraint"), self.witnesses)
        self.assertEqual(probe.name, "intent_map")  # same cost; deterministic name
        self.assertIsNone(next_probe(("stale_source",), self.witnesses))

    def test_no_separating_probe_returns_none(self):
        self.assertIsNone(next_probe(("stale_source", "wrong_tool"),
                                     (Witness("both", 1, frozenset(
                                         ("stale_source", "wrong_tool"))),)))

    def test_undeclared_fault_and_invalid_observation_rejected(self):
        with self.assertRaises(ValueError):
            compile_witnesses(self.faults,
                              (Witness("bad", 1, frozenset(("unknown",))),))
        with self.assertRaises(TypeError):
            compatible_faults(self.faults, {"source_time": 1}, self.witnesses)


if __name__ == "__main__":
    unittest.main()
