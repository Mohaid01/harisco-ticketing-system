declare module 'pdf-lib' {
  export class PDFDocument {
    static create(): PDFDocument;
    static load(data: Uint8Array | ArrayBuffer): Promise<PDFDocument>;
    addPage(size: number[]): PDFPage;
    getPages(): PDFPage[];
    embedFont(font: StandardFonts | string): Promise<Font>;
    embedPng(data: Uint8Array | ArrayBuffer): Promise<Image>;
    embedJpg(data: Uint8Array | ArrayBuffer): Promise<Image>;
    save(): Promise<Uint8Array>;
  }

  export class PDFPage {
    font: Font;
    fontBold: Font;
    drawRectangle(opts: DrawRectangleOptions): void;
    drawText(text: string, opts: DrawTextOptions): void;
    drawImage(img: unknown, opts: DrawImageOptions): void;
    drawLine(opts: DrawLineOptions): void;
    drawCircle(opts: DrawCircleOptions): void;
    getWidth(): number;
    getHeight(): number;
  }

  export enum StandardFonts {
    Helvetica = 'Helvetica',
    HelveticaBold = 'Helvetica-Bold',
    TimesRoman = 'Times-Roman',
  }

  export function rgb(r: number, g: number, b: number): RGB;

  export interface DrawRectangleOptions {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    color?: RGB;
    borderColor?: RGB;
    borderWidth?: number;
  }

  export interface DrawTextOptions {
    x?: number;
    y?: number;
    size?: number;
    font?: Font;
    color?: RGB;
    lineHeight?: number;
    maxWidth?: number;
  }

  export interface DrawImageOptions {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }

  export interface DrawLineOptions {
    start: Point;
    end: Point;
    color?: RGB;
    thickness?: number;
  }

  export interface DrawCircleOptions {
    x?: number;
    y?: number;
    size?: number;
    color?: RGB;
    borderColor?: RGB;
    borderWidth?: number;
  }

  export interface RGB {
    readonly r: number;
    readonly g: number;
    readonly b: number;
  }

  export interface Point {
    x: number;
    y: number;
  }

  export interface Font {
    widthOfTextAtSize(text: string, size: number): number;
    heightAtSize(text: string, size: number): number;
  }

  export interface Image {
    width: number;
    height: number;
  }
}
