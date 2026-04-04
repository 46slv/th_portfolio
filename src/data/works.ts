export interface Work {
  title: string;
  artist: string;
  release: string;
  x: number; // -100 (Electro) to 100 (Acoustic)
  y: number; // -100 (Popular) to 100 (Maniac)
  url: string;
}

export const works: Work[] = [
  { 
    title: "Syncopated Silence", 
    artist: "kidlit", 
    release: "2025/10/26",
    x: -30, y: 70, // ムズカシイ・ポップ
    url: "https://youtu.be/Wd-pdegEzN0" 
  },
  { 
    title: "アットホーム相談室 家建てたい篇", 
    artist: "at home", 
    release: "2025/10/11",
    x: 80, y: -80, // ピアノ・ポップ（アコースティック寄り）
    url: "https://youtu.be/pPH-ZftInjI" 
  },
  { 
    title: "CDs 2025", 
    artist: "CDs", 
    release: "2025/08/31",
    x: -80, y: 95, // カオス（極めてマニアック）
    url: "https://youtu.be/ci4NOQnobyc" 
  },
  { 
    title: "Far Out", 
    artist: "Somel", 
    release: "2025/06/23",
    x: -10, y: 30, // オリジナル曲・演奏大変
    url: "https://big-up.style/H8FbZ2YHPa" 
  },
  { 
    title: "樹氷", 
    artist: "V/R Converters", 
    release: "2025/04/24",
    x: -50, y: 50, // ユニット再始動
    url: "https://youtu.be/FrIuzAXQvpA" 
  },
  { 
    title: "アットホーム 注文住宅 新発見篇", 
    artist: "at home", 
    release: "2024/10/11",
    x: 60, y: -60, // ビッグバンド（初TVCM）
    url: "https://youtu.be/zV053nBsCzQ" 
  },
  { 
    title: "きゅびびびびずむ", 
    artist: "綿菓子かんろ", 
    release: "2025/05/28",
    x: -70, y: 80, // キッテハッタ（マニアック・エレクトロ）
    url: "https://youtu.be/aKXcwDfHxxQ" 
  }
];