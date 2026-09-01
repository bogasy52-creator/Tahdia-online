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
      const preferredDock=clamp(Math.round(height*.27),180,310);
      const availableBoardHeight=Math.max(1,height-topStrip-gap-preferredDock);
      const boardWidth=Math.max(1,Math.floor(Math.min(width,availableBoardHeight)));
      const boardHeight=availableBoardHeight<width
        ?boardWidth
        :Math.max(boardWidth,Math.round(Math.min(availableBoardHeight,width*1.22)));
      const remaining=Math.max(1,height-topStrip-gap-boardHeight);
      return Object.freeze({
        mode:'portrait',
        width,
        height,
        boardSize:boardWidth,
        boardWidth,
        boardHeight,
        topStrip,
        gap,
        dockWidth:width,
        dockHeight:remaining,
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
      boardWidth:boardSize,
      boardHeight:boardSize,
      topStrip,
      gap,
      dockWidth,
      dockHeight:height,
    });
  }

  const target=typeof window==='object'?window:self;
  target.BS_ADAPTIVE_BOARD_LAYOUT=Object.freeze({computeAdaptiveBoardLayout});
})();
