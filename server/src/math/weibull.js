/**
 * @module math/weibull
 * @description Weibull distribution utilities for modeling civic issue
 * resolution times and predicting recurrence.
 *
 * The Weibull distribution is parameterized by:
 * - **λ (lambda)** — scale parameter (characteristic life, in hours)
 * - **k** — shape parameter (> 1 ⟹ increasing failure rate)
 *
 * All time inputs (`t`) are expected in **hours**.
 */

// ─── Per-category default parameters ────────────────────────────────
/**
 * Empirically-tuned Weibull parameters for each issue category.
 * `lambda` is in hours (scale), `k` is dimensionless (shape).
 *
 * @type {Record<string, { lambda: number, k: number }>}
 */
export const DEFAULT_PARAMS = {
  pothole:     { lambda: 168, k: 1.4 },
  water_leak:  { lambda:  48, k: 1.8 },
  streetlight: { lambda: 120, k: 1.2 },
  waste:       { lambda:  72, k: 1.5 },
  road_damage: { lambda: 240, k: 1.1 },
  drainage:    { lambda:  96, k: 1.6 },
  other:       { lambda: 168, k: 1.3 },
};

// ─── Core distribution functions ─────────────────────────────────────

/**
 * Weibull cumulative distribution function.
 *
 * ```
 * F(t) = 1 − exp(−(t / λ)^k)
 * ```
 *
 * @param {number} t      — time (hours, ≥ 0)
 * @param {number} lambda — scale parameter (> 0)
 * @param {number} k      — shape parameter (> 0)
 * @returns {number} probability in [0, 1]
 */
export function weibullCDF(t, lambda, k) {
  if (t <= 0) return 0;
  if (lambda <= 0 || k <= 0) {
    throw new RangeError('lambda and k must be positive');
  }
  return 1 - Math.exp(-Math.pow(t / lambda, k));
}

/**
 * Sample a single random value from a Weibull distribution
 * using inverse-CDF (quantile) transform.
 *
 * ```
 * X = λ · (−ln(1 − U))^(1/k),   U ~ Uniform(0, 1)
 * ```
 *
 * @param {number} lambda — scale parameter (> 0), in hours
 * @param {number} k      — shape parameter (> 0)
 * @returns {number} A non-negative sample from Weibull(λ, k)
 */
export function sampleWeibull(lambda, k) {
  if (lambda <= 0 || k <= 0) {
    throw new RangeError('Weibull lambda and k must be positive');
  }
  const u = Math.max(Math.random(), 1e-15); // avoid log(0)
  return lambda * Math.pow(-Math.log(1 - u), 1 / k);
}

/**
 * Weibull probability density function.
 *
 * ```
 * f(t) = (k / λ) · (t / λ)^(k−1) · exp(−(t / λ)^k)
 * ```
 *
 * @param {number} t      — time (hours, ≥ 0)
 * @param {number} lambda — scale parameter (> 0)
 * @param {number} k      — shape parameter (> 0)
 * @returns {number} density value (≥ 0)
 */
export function weibullPDF(t, lambda, k) {
  if (t <= 0) return 0;
  if (lambda <= 0 || k <= 0) {
    throw new RangeError('lambda and k must be positive');
  }
  const ratio = t / lambda;
  return (k / lambda) * Math.pow(ratio, k - 1) * Math.exp(-Math.pow(ratio, k));
}

/**
 * Weibull hazard (instantaneous failure rate) function.
 *
 * ```
 * h(t) = (k / λ) · (t / λ)^(k−1)
 * ```
 *
 * @param {number} t      — time (hours, > 0)
 * @param {number} lambda — scale parameter (> 0)
 * @param {number} k      — shape parameter (> 0)
 * @returns {number} hazard rate (≥ 0)
 */
export function weibullHazard(t, lambda, k) {
  if (t <= 0) return 0;
  if (lambda <= 0 || k <= 0) {
    throw new RangeError('lambda and k must be positive');
  }
  return (k / lambda) * Math.pow(t / lambda, k - 1);
}

// ─── Maximum Likelihood Estimation ───────────────────────────────────

/**
 * Estimate Weibull (λ, k) parameters from observed durations using
 * Maximum Likelihood Estimation with Newton-Raphson iteration for k.
 *
 * Algorithm outline:
 * 1. Initial guess for k via the method of moments.
 * 2. Newton-Raphson iteration on the profile log-likelihood derivative
 *    with respect to k.
 * 3. Once k converges, λ is computed in closed form.
 *
 * @param {number[]} times — array of observed durations (hours, all > 0)
 * @param {Object}   [options]
 * @param {number}   [options.maxIterations=20]         — max Newton-Raphson steps
 * @param {number}   [options.convergenceThreshold=1e-6] — Δk convergence threshold
 * @returns {{ lambda: number, k: number }} estimated parameters
 * @throws {Error} if `times` is empty or contains non-positive values
 *
 * @example
 * const { lambda, k } = weibullMLE([24, 48, 36, 72, 60]);
 */
export function weibullMLE(times, { maxIterations = 20, convergenceThreshold = 1e-6 } = {}) {
  if (!Array.isArray(times) || times.length === 0) {
    throw new Error('times array must be non-empty');
  }

  const n = times.length;

  // Validate — all times must be positive
  for (let i = 0; i < n; i++) {
    if (times[i] <= 0) {
      throw new Error(`All times must be positive, got ${times[i]} at index ${i}`);
    }
  }

  // Edge case: single observation — can't estimate shape, return defaults
  if (n === 1) {
    return { lambda: times[0], k: 1.0 };
  }

  // Pre-compute log(t_i)
  const logT = times.map(Math.log);
  const sumLogT = logT.reduce((a, b) => a + b, 0);
  const meanLogT = sumLogT / n;

  // ── Initial guess for k via method of moments ────────────────────
  // Var(ln T) ≈ π² / (6 k²)  ⟹  k₀ ≈ π / (√6 · σ(ln T))
  const varLogT = logT.reduce((s, v) => s + (v - meanLogT) ** 2, 0) / n;
  let k = varLogT > 0 ? Math.PI / (Math.sqrt(6 * varLogT)) : 1.0;

  // Clamp initial guess to a sensible range
  k = Math.max(0.1, Math.min(k, 10));

  // ── Newton-Raphson on ∂ℓ/∂k = 0 ─────────────────────────────────
  // Profile log-likelihood derivative with respect to k:
  //   g(k) = n/k + Σ ln(t_i) − n · Σ[t_i^k · ln(t_i)] / Σ[t_i^k]
  //
  // Its derivative (for Newton step):
  //   g'(k) = −n/k²  − n · { Σ[t_i^k · (ln t_i)²] · Σ[t_i^k]
  //                          − (Σ[t_i^k · ln t_i])² } / (Σ[t_i^k])²

  for (let iter = 0; iter < maxIterations; iter++) {
    let sumTk = 0;
    let sumTkLogT = 0;
    let sumTkLogT2 = 0;

    for (let i = 0; i < n; i++) {
      const tk = Math.pow(times[i], k);
      const lt = logT[i];
      sumTk += tk;
      sumTkLogT += tk * lt;
      sumTkLogT2 += tk * lt * lt;
    }

    const A = sumTkLogT / sumTk;
    const g = n / k + sumLogT - n * A;

    // Derivative of g
    const gPrime =
      -n / (k * k) -
      n * (sumTkLogT2 * sumTk - sumTkLogT * sumTkLogT) / (sumTk * sumTk);

    if (Math.abs(gPrime) < 1e-30) break; // avoid division by zero

    const delta = g / gPrime;
    k -= delta;

    // Keep k positive and bounded
    k = Math.max(0.01, Math.min(k, 50));

    if (Math.abs(delta) < convergenceThreshold) break;
  }

  // ── Compute λ in closed form ─────────────────────────────────────
  let sumTk = 0;
  for (let i = 0; i < n; i++) {
    sumTk += Math.pow(times[i], k);
  }
  const lambda = Math.pow(sumTk / n, 1 / k);

  return { lambda, k };
}
