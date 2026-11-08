import unittest

from services.gemini_service import build_phonics_word_hunt_prompt
from services.wikimedia_service import _build_contextual_search_query


class WordIllustrationQueryTests(unittest.TestCase):
    def test_build_contextual_search_query_uses_context_for_contextual_meaning(self):
        query = _build_contextual_search_query(
            "bank",
            "The boat drifted slowly along the river bank as the children waved.",
        )

        self.assertIn("bank", query.lower())
        self.assertIn("river", query.lower())
        self.assertIn("boat", query.lower())
        self.assertNotIn("ai-generated", query.lower())

    def test_build_contextual_search_query_avoids_empty_or_generic_queries(self):
        query = _build_contextual_search_query("light", "")

        self.assertIn("light", query.lower())
        self.assertGreater(len(query.split()), 1)

    def test_build_phonics_word_hunt_prompt_biases_multi_answer_primary_school_questions(self):
        prompt = build_phonics_word_hunt_prompt("The ship sailed with a shiny light.")

        self.assertIn("more than one", prompt.lower())
        self.assertIn("primary school", prompt.lower())
        self.assertIn("simple", prompt.lower())


if __name__ == "__main__":
    unittest.main()
