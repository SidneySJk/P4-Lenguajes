class Recursos {
  constructor(minerales = 0, energia = 0, cristales = 0) {
    this.minerales = minerales;
    this.energia   = energia;
    this.cristales = cristales;
  }

  sumar(other) {
    return new Recursos(
      this.minerales + other.minerales,
      this.energia   + other.energia,
      this.cristales + other.cristales
    );
  }

  restar(other) {
    return new Recursos(
      Math.max(0, this.minerales - other.minerales),
      Math.max(0, this.energia   - other.energia),
      Math.max(0, this.cristales - other.cristales)
    );
  }

  cubreCosto(costo) {
    return (
      this.minerales >= costo.minerales &&
      this.energia   >= costo.energia   &&
      this.cristales >= costo.cristales
    );
  }

  puntuacion() {
    return this.minerales * 1 + this.energia * 2 + this.cristales * 3;
  }

  toJSON() {
    return { minerales: this.minerales, energia: this.energia, cristales: this.cristales };
  }
}

module.exports = Recursos;
