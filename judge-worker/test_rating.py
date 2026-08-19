import unittest

from rating import Rating, update_rating, visible_rank


class Glicko2Tests(unittest.TestCase):
    def test_win_increases_rating_and_reduces_uncertainty(self):
        player = Rating(1500, 350, 0.06)
        after = update_rating(player, player, 1.0)
        self.assertGreater(after.mmr, player.mmr)
        self.assertLess(after.deviation, player.deviation)

    def test_draw_between_equal_players_preserves_rating(self):
        player = Rating(1500, 200, 0.06)
        after = update_rating(player, player, 0.5)
        self.assertAlmostEqual(after.mmr, player.mmr, places=6)

    def test_visible_rank_does_not_return_rating(self):
        self.assertEqual(visible_rank(1500), ("Gold", "III"))
        self.assertEqual(visible_rank(2800), ("Grandmaster Coder", None))


if __name__ == "__main__":
    unittest.main()
