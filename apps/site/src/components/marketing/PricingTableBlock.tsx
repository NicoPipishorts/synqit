import { PricingComparison, type PricingTable } from './PricingComparison';
import { SectionHeading } from './SectionHeading';

type PricingTableBlockProps = {
  title: string;
  subtitle: string;
  table: PricingTable;
};

export const PricingTableBlock = ({ title, subtitle, table }: PricingTableBlockProps) => (
  <section className="mb-16">
    <div className="mb-6">
      <SectionHeading title={title} description={subtitle} />
    </div>
    <PricingComparison table={table} />
  </section>
);
