"""Glicko-2 rating calculations. MMR is never returned to the client."""
from dataclasses import dataclass
from math import exp, log, pi, sqrt

GLICKO_SCALE = 173.7178
TAU = 0.5
MAX_RD = 350.0


@dataclass(frozen=True)
class Rating:
    mmr: float
    deviation: float
    volatility: float


def update_rating(player: Rating, opponent: Rating, outcome: float) -> Rating:
    """Apply one Glicko-2 period for a head-to-head result (1, .5, or 0)."""
    mu = (player.mmr - 1500.0) / GLICKO_SCALE
    phi = player.deviation / GLICKO_SCALE
    other_mu = (opponent.mmr - 1500.0) / GLICKO_SCALE
    other_phi = opponent.deviation / GLICKO_SCALE
    g = 1.0 / sqrt(1.0 + 3.0 * other_phi * other_phi / (pi * pi))
    expected = 1.0 / (1.0 + exp(-g * (mu - other_mu)))
    variance = 1.0 / (g * g * expected * (1.0 - expected))
    delta = variance * g * (outcome - expected)
    a = log(player.volatility * player.volatility)

    def f(value: float) -> float:
        numerator = exp(value) * (delta * delta - phi * phi - variance - exp(value))
        denominator = 2.0 * (phi * phi + variance + exp(value)) ** 2
        return numerator / denominator - (value - a) / (TAU * TAU)

    lower = a
    if delta * delta > phi * phi + variance:
        upper = log(delta * delta - phi * phi - variance)
    else:
        step = 1
        upper = a - step * TAU
        while f(upper) < 0.0:
            step += 1
            upper = a - step * TAU
    f_lower, f_upper = f(lower), f(upper)
    while abs(upper - lower) > 1e-6:
        candidate = lower + (lower - upper) * f_lower / (f_upper - f_lower)
        f_candidate = f(candidate)
        if f_candidate * f_upper < 0.0:
            lower, f_lower = upper, f_upper
        else:
            f_lower /= 2.0
        upper, f_upper = candidate, f_candidate
    new_volatility = exp(lower / 2.0)
    phi_star = sqrt(phi * phi + new_volatility * new_volatility)
    new_phi = 1.0 / sqrt(1.0 / (phi_star * phi_star) + 1.0 / variance)
    new_mu = mu + new_phi * new_phi * g * (outcome - expected)
    return Rating(
        mmr=1500.0 + GLICKO_SCALE * new_mu,
        deviation=min(MAX_RD, GLICKO_SCALE * new_phi),
        volatility=new_volatility,
    )


def visible_rank(mmr: float) -> tuple[str, str | None]:
    """Thresholds are product-facing rank labels; numerical MMR remains server-only."""
    bands = [
        (1000, "Bronze", "III"), (1100, "Bronze", "II"), (1200, "Bronze", "I"),
        (1300, "Silver", "III"), (1400, "Silver", "II"), (1500, "Silver", "I"),
        (1600, "Gold", "III"), (1700, "Gold", "II"), (1800, "Gold", "I"),
        (1900, "Platinum", "III"), (2000, "Platinum", "II"), (2100, "Platinum", "I"),
        (2200, "Diamond", "III"), (2300, "Diamond", "II"), (2400, "Diamond", "I"),
        (2700, "Master Coder", None),
    ]
    for ceiling, tier, division in bands:
        if mmr < ceiling:
            return tier, division
    return "Grandmaster Coder", None
