import { type LegalBlock, type LegalSection } from '../../content/legal';

const Block = ({ block }: { block: LegalBlock }) => {
  switch (block.kind) {
    case 'p':
      return (
        <p className="text-sm leading-relaxed text-app-text-secondary sm:text-base">{block.text}</p>
      );

    case 'list':
      return (
        <ul className="flex flex-col gap-2">
          {block.items.map((item) => (
            <li
              key={item}
              className="relative pl-5 text-sm leading-relaxed text-app-text-secondary before:absolute before:left-0 before:top-[0.6em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-brand-pink sm:text-base"
            >
              {item}
            </li>
          ))}
        </ul>
      );

    case 'note':
      return (
        <p className="rounded-2xl border-2 border-app-text bg-brand-lime/20 p-4 text-sm leading-relaxed text-app-text sm:text-base">
          {block.text}
        </p>
      );

    case 'table': {
      // Some tables are two-column key/value pairs with no meaningful header.
      const hasHead = block.head.some((cell) => cell.trim() !== '');
      return (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            {hasHead && (
              <thead>
                <tr>
                  {block.head.map((cell) => (
                    <th
                      key={cell}
                      scope="col"
                      className="border-b-2 border-app-text px-3 py-2 text-xs font-black uppercase tracking-wide text-app-text"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join('|')} className="align-top">
                  {row.map((cell, index) => (
                    <td
                      key={`${cell}-${index}`}
                      className={`border-b border-app-border px-3 py-3 leading-relaxed ${
                        index === 0 ? 'font-bold text-app-text' : 'text-app-text-secondary'
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }
};

export const LegalDocumentBody = ({ sections }: { sections: readonly LegalSection[] }) => (
  <div className="flex flex-col gap-12 sm:gap-16">
    {sections.map((section, index) => (
      <section key={section.id} id={section.id} className="scroll-mt-28 sm:scroll-mt-36">
        <h2 className="flex items-baseline gap-3 text-xl font-black leading-tight tracking-tight text-brand-dark dark:text-brand-white sm:text-2xl">
          <span aria-hidden="true" className="text-sm font-black text-brand-pink">
            {String(index + 1).padStart(2, '0')}
          </span>
          {section.heading}
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          {section.blocks.map((block, blockIndex) => (
            <Block key={`${section.id}-${blockIndex}`} block={block} />
          ))}
        </div>
      </section>
    ))}
  </div>
);
