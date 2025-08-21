export class Clock {
  private _t = 0; // ms
  constructor(public readonly timeScale = 50) {}
  now() { return this._t; }
  async sleep(dtMs: number) {
    this._t += dtMs;
  }
}
