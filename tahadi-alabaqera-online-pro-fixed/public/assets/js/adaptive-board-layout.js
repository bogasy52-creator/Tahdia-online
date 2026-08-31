(() => {
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const pixel=(value)=>Math.max(1,Math.floor(Number.isFinite(Number(value))?Number(value):1));

  function computeAdaptiveBoardLayout(viewport={}){
    const width=pixel(viewport.width);
    const height=pixel(viewport.height);
    const portrait=height>=width;

    if(portrait){
      const topStrip=36;
      const gap=2;
      const minimumDock=180;
      const boardSize=Math.max(1,Math.floor(Math.min(width,height-topStrip-gap-minimumDock)));
      const remaining=height-topStrip-gap-boardSize;
      return Object.freeze({
        mode:'portrait',
        width,
        height,
        boardSize,
        topStrip,
        gap,
        dockWidth:width,
        dockHeight:clamp(remaining,minimumDock,230),
      });
    }

    const topStrip=0;
    const gap=4;
    const dockWidth=clamp(Math.round(width*.24),168,300);
    const boardSize=Math.max(1,Math.floor(Math.min(height,width-dockWidth-gap)));
    return Object.freeze({
      mode:'landscape',
      width,
      height,
      boardSize,
      topStrip,
      gap,
      dockWidth,
      dockHeight:height,
    });
  }

  const target=typeof window==='object'?window:self;
  target.BS_ADAPTIVE_BOARD_LAYOUT=Object.freeze({computeAdaptiveBoardLayout});
})();
