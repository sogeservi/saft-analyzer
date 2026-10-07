declare module "pdfmake" {
  import type { TDocumentDefinitions } from "pdfmake/interfaces";

  interface FontDescriptors {
    [fontName: string]: {
      normal: string;
      bold: string;
      italics: string;
      bolditalics: string;
    };
  }

  class PdfPrinter {
    constructor(fonts: FontDescriptors);
    createPdfKitDocument(
      docDefinition: TDocumentDefinitions,
    ): import("stream").Readable & { end(): void };
  }

  export default PdfPrinter;
}

declare module "pdfmake/interfaces" {
  type Margins = number | [number, number] | [number, number, number, number];
  type PageSize = "A4" | "A3" | "LETTER" | "LEGAL" | string;
  type Alignment = "left" | "center" | "right" | "justify";

  interface Style {
    fontSize?: number;
    font?: string;
    bold?: boolean;
    italics?: boolean;
    alignment?: Alignment;
    color?: string;
    fillColor?: string;
    margin?: Margins;
    lineHeight?: number;
    characterSpacing?: number;
  }

  interface ContentText {
    text: string | Content[];
    style?: string | string[];
    fontSize?: number;
    font?: string;
    bold?: boolean;
    italics?: boolean;
    alignment?: Alignment;
    color?: string;
    fillColor?: string;
    margin?: Margins;
    lineHeight?: number;
    characterSpacing?: number;
    pageBreak?: "before" | "after";
    width?: number | string;
    colSpan?: number;
    rowSpan?: number;
  }

  interface ContentColumns {
    columns: Content[];
    columnGap?: number;
    margin?: Margins;
  }

  interface ContentTable {
    table: {
      headerRows?: number;
      widths?: (number | string)[];
      body: Content[][];
    };
    layout?:
      | string
      | {
          hLineWidth?: (i: number, node: unknown) => number;
          vLineWidth?: (i: number, node: unknown) => number;
          hLineColor?: (i: number, node: unknown) => string;
          vLineColor?: (i: number, node: unknown) => string;
          fillColor?: (rowIndex: number, node: unknown, columnIndex: number) => string | null;
          paddingLeft?: (i: number) => number;
          paddingRight?: (i: number) => number;
          paddingTop?: (i: number) => number;
          paddingBottom?: (i: number) => number;
        };
    margin?: Margins;
  }

  interface ContentStack {
    stack: Content[];
    margin?: Margins;
  }

  interface ContentSvg {
    svg: string;
    width?: number;
    height?: number;
    margin?: Margins;
  }

  type Content =
    | string
    | ContentText
    | ContentColumns
    | ContentTable
    | ContentStack
    | ContentSvg
    | Content[];

  interface TDocumentDefinitions {
    content: Content | Content[];
    pageSize?: PageSize;
    pageMargins?: Margins;
    defaultStyle?: Style;
    styles?: Record<string, Style>;
    header?: Content | ((currentPage: number, pageCount: number) => Content);
    footer?: Content | ((currentPage: number, pageCount: number) => Content);
    pageBreakBefore?: (
      currentNode: unknown,
      followingNodesOnPage: unknown[],
      nodesOnNextPage: unknown[],
      previousNodesOnPage: unknown[],
    ) => boolean;
  }
}
