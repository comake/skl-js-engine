export class VariableGenerator {
  private currentVariable = 0;

  public getNext(): string {
    this.currentVariable += 1;
    return `c${this.currentVariable}`;
  }
}
