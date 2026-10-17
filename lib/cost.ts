// Rough per-episode cost tracking. Estimates only — actual billing depends on
// your OpenAI/ElevenLabs plans. Rates are conservative list-price guesses.
export interface CostBreakdown {
  scriptUSD: number;
  voiceUSD: number;
  imagesUSD: number;
  totalUSD: number;
}

const RATES = {
  scriptPerCall: 0.003, // gpt-4o-mini, ~1.5k tokens in/out
  voicePerThousandChars: 0.18, // ElevenLabs multilingual, mid-tier plan
  imageMedium: 0.02, // gpt-image-1 medium 1024x1536
  imageDallE3: 0.08, // dall-e-3 1024x1792 standard
};

export function estimateEpisodeCost(opts: {
  voiceChars: number;
  imageCount: number;
  imageModel?: string;
}): CostBreakdown {
  const scriptUSD = RATES.scriptPerCall;
  const voiceUSD = (opts.voiceChars / 1000) * RATES.voicePerThousandChars;
  const perImage = opts.imageModel === "dall-e-3" ? RATES.imageDallE3 : RATES.imageMedium;
  const imagesUSD = opts.imageCount * perImage;
  return {
    scriptUSD,
    voiceUSD,
    imagesUSD,
    totalUSD: scriptUSD + voiceUSD + imagesUSD,
  };
}
