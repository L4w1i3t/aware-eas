// Beta distribution utilities for Bayesian updating and priority weight suggestion.
export type BetaParams = {
  alpha: number;
  beta: number;
};

// Prior: uniform
export type Observation = {
  successes: number;
  failures: number;
};

// Update Beta distribution parameters with new observation
export function updateBeta(prior: BetaParams, observation: Observation): BetaParams {
  return {
    alpha: prior.alpha + Math.max(0, observation.successes),
    beta: prior.beta + Math.max(0, observation.failures)
  };
}

// Mean of Beta distribution
export function betaMean(params: BetaParams): number {
  const denom = params.alpha + params.beta;
  return denom > 0 ? params.alpha / denom : 0.5;
}

// Suggest priority weight adjustments based on Bayesian update of alert usefulness
export function suggestPriorityWeights(prior: BetaParams, observation: Observation) {
  const posterior = updateBeta(prior, observation);
  const mean = betaMean(posterior);
  const severityWeight = 2 + mean * 2;
  const urgencyWeight = 1 + mean;
  const freshnessWeight = 3 + (1 - mean) * 2;
  return {
    posterior,
    weights: {
      wS: Number(severityWeight.toFixed(2)),
      wU: Number(urgencyWeight.toFixed(2)),
      wF: Number(freshnessWeight.toFixed(2))
    }
  };
}
