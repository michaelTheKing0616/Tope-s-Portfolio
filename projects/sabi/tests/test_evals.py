import unittest

from sabi.evals import run_evals


class TestEvals(unittest.TestCase):
    def test_full_suite_passes(self) -> None:
        report = run_evals()
        # The reference dataset is expected to pass completely; this doubles as a
        # regression gate on planner + tools + critic behaviour.
        self.assertEqual(report.task_success_rate, 1.0, report.render())
        self.assertEqual(report.tool_accuracy, 1.0, report.render())


if __name__ == "__main__":
    unittest.main()
