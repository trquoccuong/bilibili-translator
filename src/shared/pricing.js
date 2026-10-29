// Claude pricing and cost math.

// USD per 1M tokens [input, output]. Haiku 5.5 doubles above 100K-token prompts; our chunks stay far below.
const PRICES = {
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-sonnet-5-5': [2, 10],
  'claude-opus-5-5': [4, 20],
};

function costUSD(model, inTok, outTok) {
  const [i, o] = PRICES[model] || [0, 0];
  return (inTok * i + outTok * o) / 1e6;
}
