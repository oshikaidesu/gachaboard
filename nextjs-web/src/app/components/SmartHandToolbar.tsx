"use client";

import {
  DefaultToolbar,
  TldrawUiMenuToolItem,
  useValue,
  DrawToolbarItem,
  EraserToolbarItem,
  ArrowToolbarItem,
  TextToolbarItem,
  AssetToolbarItem,
  RectangleToolbarItem,
  EllipseToolbarItem,
  TriangleToolbarItem,
  DiamondToolbarItem,
  HexagonToolbarItem,
  OvalToolbarItem,
  RhombusToolbarItem,
  StarToolbarItem,
  CloudToolbarItem,
  HeartToolbarItem,
  XBoxToolbarItem,
  CheckBoxToolbarItem,
  ArrowLeftToolbarItem,
  ArrowUpToolbarItem,
  ArrowDownToolbarItem,
  ArrowRightToolbarItem,
  LineToolbarItem,
  HighlightToolbarItem,
  LaserToolbarItem,
  FrameToolbarItem,
} from "@tldraw/tldraw";
import { brushModeAtom } from "@/app/tools/SmartHandTool";

/**
 * 範囲選択トグルボタン付きツールバー。
 * select ツールのボタンを先頭に置き、isSelected を brushModeAtom で制御する。
 * DefaultToolbarContent は使わず select の重複を避ける。
 */
export function SmartHandToolbar(props: React.ComponentProps<typeof DefaultToolbar>) {
  const isBrushMode = useValue("brushMode", () => brushModeAtom.get(), []);
  return (
    <DefaultToolbar {...props}>
      <TldrawUiMenuToolItem toolId="select" isSelected={isBrushMode} />
      <DrawToolbarItem />
      <EraserToolbarItem />
      <ArrowToolbarItem />
      <TextToolbarItem />
      <AssetToolbarItem />
      <RectangleToolbarItem />
      <EllipseToolbarItem />
      <TriangleToolbarItem />
      <DiamondToolbarItem />
      <HexagonToolbarItem />
      <OvalToolbarItem />
      <RhombusToolbarItem />
      <StarToolbarItem />
      <CloudToolbarItem />
      <HeartToolbarItem />
      <XBoxToolbarItem />
      <CheckBoxToolbarItem />
      <ArrowLeftToolbarItem />
      <ArrowUpToolbarItem />
      <ArrowDownToolbarItem />
      <ArrowRightToolbarItem />
      <LineToolbarItem />
      <HighlightToolbarItem />
      <LaserToolbarItem />
      <FrameToolbarItem />
    </DefaultToolbar>
  );
}
