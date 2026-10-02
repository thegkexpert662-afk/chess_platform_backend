export function parseTimeControl(value='600+0') {
  const match = /^(\\d{1,6})\\+(\\d{1,6})$/.exec(String(value));
  if (!match) throw Object.assign(new Error('Invalid time control'),{status:400,code:'INVALID_TIME_CONTROL'});
  const baseSeconds=Number(match[1]);
  const incrementSeconds=Number(match[2]);
  if(baseSeconds<1 || baseSeconds>86400 || incrementSeconds>3600) {
    throw Object.assign(new Error('Unsupported time control'),{status:400,code:'INVALID_TIME_CONTROL'});
  }
  return {baseMs:baseSeconds*1000,incrementMs:incrementSeconds*1000};
}

export function remainingMs(game, now=Date.now()) {
  const white=Number(game.white_time_ms);
  const black=Number(game.black_time_ms);
  if(game.status!=='active' || !game.turn_started_at) return {whiteMs:white,blackMs:black};
  const elapsed=Math.max(0, now-new Date(game.turn_started_at).getTime());
  if(game.next_turn==='white') return {whiteMs:Math.max(0,white-elapsed),blackMs:black};
  return {whiteMs:white,blackMs:Math.max(0,black-elapsed)};
}
