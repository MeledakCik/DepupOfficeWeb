declare module "mammoth/mammoth.browser.js" {
  const mammoth: { convertToHtml(source: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }> };
  export default mammoth;
}
declare module "fast-formula-parser" {
  export default class FormulaParser {
    constructor(options: {
      functions: Record<string, () => never>;
      onCell: (cell: { sheet?: string; row: number; col: number }) => unknown;
      onRange: (range: {
        sheet?: string;
        from: { row: number; col: number };
        to: { row: number; col: number };
      }) => unknown;
    });
    parse(formula: string, position: { row: number; col: number; sheet: string }): unknown;
  }
}
