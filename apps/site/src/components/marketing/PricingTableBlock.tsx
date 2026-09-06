import { Sticker, type StickerTone } from '@synqit/ui';

import { PricingComparison, type PricingTable } from './PricingComparison';

type PricingTableBlockProps = {
  index: string;
  tone: StickerTone;
  title: string;
  subtitle: string;
  table: PricingTable;
};

export const PricingTableBlock = ({
  index,
  tone,
  title,
  subtitle,
  table,
}: PricingTableBlockProps) => (
  <section className="relative mb-20 sm:mb-24">
    <div className="mb-8 flex flex-col items-start gap-3 sm:mb-10">
      <Sticker tone={tone} tilt="-rotate-2">
        {index} · {title}
      </Sticker>
      <h2 className="max-w-2xl text-2xl font-black leading-[1.05] tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
        {subtitle}
      </h2>
    </div>
    <PricingComparison table={table} />
  </section>
);
