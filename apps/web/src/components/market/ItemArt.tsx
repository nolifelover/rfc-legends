// Item tile + title used by every market card: the game's item art (or its
// emoji), the English-first name, and the catalog's Thai name as a subtitle.

import type { ItemInfo } from "./chain";

export function ItemArt({ info }: { info: ItemInfo }) {
  return (
    <div
      aria-hidden
      className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br text-2xl shadow-inner ${info.tone}`}
    >
      {info.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={info.image} alt="" width={44} height={44} className="h-11 w-11 object-contain drop-shadow" />
      ) : (
        info.glyph
      )}
    </div>
  );
}

export function ItemTitle({ info }: { info: ItemInfo }) {
  return (
    <p className="truncate font-bold text-bark">
      {info.name}
      {info.thai ? (
        <span lang="th" className="ml-1.5 text-sm font-medium text-bark-soft">
          {info.thai}
        </span>
      ) : null}
    </p>
  );
}
