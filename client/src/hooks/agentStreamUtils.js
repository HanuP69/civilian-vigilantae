export function mergeAgentTrace(existingSteps = [], incomingSteps = []) {
  const merged = [...existingSteps];

  incomingSteps.forEach((step) => {
    if (!step) return;
    const existingIndex = merged.findIndex((item) => item?.step === step.step);
    if (existingIndex >= 0) {
      merged[existingIndex] = { ...merged[existingIndex], ...step, index: existingIndex };
    } else {
      merged.push({ ...step, index: merged.length });
    }
  });

  return merged.map((step, index) => ({ ...step, index }));
}
