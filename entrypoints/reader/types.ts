export type SelectionRect = {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
};

export type SelectionInfo = {
  text: string;
  rect: SelectionRect;
};
