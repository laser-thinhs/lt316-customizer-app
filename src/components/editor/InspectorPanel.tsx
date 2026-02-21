import { PlacementDocument, PlacementObject, TextObject, ImagePlacementObject } from "@/schemas/placement";

type ValidationError = {
  field: string;
  message: string;
};

type TransformValues = {
  xMm: string;
  yMm: string;
  widthMm: string;
  heightMm: string;
  rotationDeg: string;
};

type Props = {
  doc: PlacementDocument;
  selected: PlacementObject | null;
  selectedObjectId: string | null;
  transformValues: TransformValues;
  validationErrors: ValidationError[];
  onSelectedObjectChange: (id: string | null) => void;
  onTransformChange: (field: keyof TransformValues, value: string) => void;
  onBlurTransformField: (field: keyof TransformValues) => void;
  onToggleAspectRatio: () => void;
  onResetRotation: () => void;
  onCenterOnCanvas: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onUpdateOpacity: (opacity: number) => void;
  onToggleLock: () => void;
  onToggleHide: () => void;
  onUpdateBlendMode: (blendMode: string) => void;
  hiddenObjectIds: Set<string>;
  lockedObjectIds: Set<string>;
  blendModeByObjectId: Record<string, string>;
};

const blendOptions = ["normal", "multiply", "screen", "overlay"];

function isImageObject(object: PlacementObject | null): object is ImagePlacementObject {
  return Boolean(object && object.kind === "image");
}

function isTextObject(object: PlacementObject | null): object is TextObject {
  return Boolean(object && (object.kind === "text_line" || object.kind === "text_block" || object.kind === "text_arc"));
}

export default function InspectorPanel({
  doc,
  selected,
  selectedObjectId,
  transformValues,
  validationErrors,
  onSelectedObjectChange,
  onTransformChange,
  onBlurTransformField,
  onToggleAspectRatio,
  onResetRotation,
  onCenterOnCanvas,
  onDuplicate,
  onDelete,
  onBringForward,
  onSendBackward,
  onUpdateOpacity,
  onToggleLock,
  onToggleHide,
  onUpdateBlendMode,
  hiddenObjectIds,
  lockedObjectIds,
  blendModeByObjectId
}: Props) {
  const errorByField = new Map(validationErrors.map((entry) => [entry.field, entry.message]));
  const isLocked = selected ? lockedObjectIds.has(selected.id) : false;
  const isHidden = selected ? hiddenObjectIds.has(selected.id) : false;
  const blendMode = selected ? (blendModeByObjectId[selected.id] ?? "normal") : "normal";

  return (
    <aside className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-black">
      <div>
        <h3 className="text-base font-semibold text-black">Inspector</h3>
        <p className="text-xs text-black">Object controls · units stay in mm and deg.</p>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Selected Object</span>
        <select
          name="selectedObjectId"
          value={selectedObjectId ?? ""}
          onChange={(event) => onSelectedObjectChange(event.target.value || null)}
          className="w-full rounded border border-slate-300 bg-white px-2 py-1"
        >
          <option value="">None</option>
          {doc.objects.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.kind}:{entry.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>

      {selected ? (
        <>
          <section className="space-y-2 rounded border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Transform</h4>
              {isImageObject(selected) ? (
                <button type="button" className="text-xs text-black underline" onClick={onToggleAspectRatio}>
                  {selected.lockAspectRatio ? "Unlink aspect ratio" : "Link aspect ratio"}
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {[
                ["xMm", "X", "mm"],
                ["yMm", "Y", "mm"],
                ["widthMm", "Width", "mm"],
                ["heightMm", "Height", "mm"],
                ["rotationDeg", "Rotation", "deg"]
              ].map(([field, label, unit]) => {
                const hasError = errorByField.has(field);
                return (
                  <label key={field} className="text-sm">
                    <span className="mb-1 block font-medium text-black">
                      {label} <span className="text-xs text-black">({unit})</span>
                    </span>
                    <input
                      name={`transform-${field}`}
                      type="number"
                      step="0.01"
                      value={transformValues[field as keyof TransformValues]}
                      onChange={(event) => onTransformChange(field as keyof TransformValues, event.target.value)}
                      onBlur={() => onBlurTransformField(field as keyof TransformValues)}
                      className={`w-full rounded border px-2 py-1 ${hasError ? "border-red-500" : "border-slate-300"}`}
                    />
                    {hasError ? <span className="text-xs text-black">{errorByField.get(field)}</span> : null}
                  </label>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded border px-2 py-1 text-xs" onClick={onResetRotation}>Reset rotation</button>
              <button type="button" className="rounded border px-2 py-1 text-xs" onClick={onCenterOnCanvas}>Center on canvas</button>
            </div>
          </section>

          <section className="space-y-2 rounded border border-slate-200 bg-white p-3">
            <h4 className="text-sm font-semibold">Appearance</h4>
            {isImageObject(selected) || isTextObject(selected) ? (
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Opacity</span>
                <input
                  name="opacity"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isImageObject(selected) ? selected.opacity : 1}
                  onChange={(event) => onUpdateOpacity(Number(event.target.value))}
                  className="w-full"
                />
              </label>
            ) : null}
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Blend (optional)</span>
              <select
                name="blendMode"
                className="w-full rounded border border-slate-300 bg-white px-2 py-1"
                value={blendMode}
                onChange={(event) => onUpdateBlendMode(event.target.value)}
              >
                {blendOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input name="isLocked" type="checkbox" checked={isLocked} onChange={onToggleLock} />
                Lock
              </label>
              <label className="inline-flex items-center gap-2">
                <input name="isHidden" type="checkbox" checked={isHidden} onChange={onToggleHide} />
                Hide
              </label>
            </div>
          </section>

          <section className="space-y-2 rounded border border-slate-200 bg-white p-3">
            <h4 className="text-sm font-semibold">Actions</h4>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="rounded border px-2 py-1 text-xs" onClick={onDuplicate}>Duplicate</button>
              <button type="button" className="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={onDelete}>Delete</button>
              <button type="button" className="rounded border px-2 py-1 text-xs" onClick={onBringForward}>Bring Forward</button>
              <button type="button" className="rounded border px-2 py-1 text-xs" onClick={onSendBackward}>Send Backward</button>
            </div>
          </section>
        </>
      ) : (
        <p className="rounded border border-dashed border-slate-300 bg-white p-3 text-xs text-black">
          Select an object to edit transform, appearance, and actions.
        </p>
      )}
    </aside>
  );
}
