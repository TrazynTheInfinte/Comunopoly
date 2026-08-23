export interface PropagandaAd {
  /** Filename under public/images/ads/. */
  file: string;
  alt: string;
}

// Fake, deadpan-funny Soviet-poster-style ads, standing in for the old
// single static banner - GameBoard picks one by turnCount % length (see
// PropagandaAd.tsx), so every viewer sees the same ad at the same time
// and it changes once each time the turn actually passes to someone
// else. Add more here any time; no code changes needed elsewhere.
export const PROPAGANDA_ADS: PropagandaAd[] = [
  { file: 'ad-01.png', alt: 'Ad: Five-Year Plan brand toothpaste - now with 20% more paste, delivered in Year 4.' },
  { file: 'ad-02.png', alt: 'Ad: State Bread Queue Simulator - now you can wait in line from the comfort of your own line.' },
  { file: 'ad-03.png', alt: "Ad: Comrade's Own Umbrella - one per household, weather permitting, permission pending." },
  { file: 'ad-04.png', alt: 'Ad: Collective Farm Tractor Model T-1 - now assigned to a farm near you, eventually.' },
  { file: 'ad-05.png', alt: 'Ad: Gulag Timeshares - beautiful Siberian views, non-refundable, non-optional.' },
  { file: 'ad-06.png', alt: 'Ad: The New Soviet Toaster - browns bread and dissent equally.' },
  { file: 'ad-07.png', alt: 'Ad: Free Speech - one per citizen, return after use.' },
  { file: 'ad-08.png', alt: 'Ad: Premium Vodka Ration - now available in regular and "for the Party" strength.' },
  { file: 'ad-09.png', alt: 'Ad: Comrade Cola - tastes like victory, rations like scarcity.' },
  { file: 'ad-10.png', alt: "Ad: The People's Wristwatch - tells you exactly what time the State says it is." },
  { file: 'ad-11.png', alt: 'Ad: Home Informant Starter Kit - everything you need to report your neighbor, batteries included.' },
  { file: 'ad-12.png', alt: "Ad: Lenin's Own Mattress Company - sleep soundly, we're always watching." },
  { file: 'ad-13.png', alt: 'Ad: Gulag Timeshares (alternate) - beautiful Siberian views.' },
  { file: 'ad-14.png', alt: 'Ad: Free Speech, Government Issue - one per citizen.' },
  { file: 'ad-15.png', alt: 'Ad: Free Speech, Government Issue (alternate) - one per citizen.' },
  { file: 'ad-16.png', alt: 'Ad: Premium Vodka, For the Party - tastes like victory, rations like scarcity.' },
];
