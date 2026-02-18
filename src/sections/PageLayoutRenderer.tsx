import { PageLayout } from "@/lib/page-layout/types";
import { sectionRegistry } from "@/sections/registry";

type Props = {
  layout: PageLayout;
  selectedId?: string | null;
  onSelectSection?: (id: string) => void;
  editable?: boolean;
};

export function PageLayoutRenderer({ layout, selectedId, onSelectSection, editable = false }: Props) {
  return (
    <div className="space-y-4">
      {layout.sections.map((section) => {
        if (section.hidden) {
          return null;
        }

        const definition = sectionRegistry[section.type];

        return (
          <div
            key={section.id}
            className={`${editable ? "cursor-pointer rounded-xl p-1" : ""} ${selectedId === section.id ? "ring-2 ring-indigo-500" : ""}`}
            onClick={editable ? () => onSelectSection?.(section.id) : undefined}
          >
            {definition.render(section.settings)}
          </div>
        );
      })}
    </div>
  );
}
