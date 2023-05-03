"use strict";

const ERC20 = require("../lib/ERC20.js");

class Eleccion {
  constructor(idEleccion, fecha) {
    this.idEleccion = idEleccion;
    this.fecha = fecha;
    this.finished = false;
    this.votosReceived = [];
  }

  set VotosReceived(_votosReceived) {
    this.votosReceived = _votosReceived;
  }

  get VotosReceived() {
    return this.votosReceived;
  }

  set Finished(_finished) {
    this.finished = _finished;
  }

  get Finished() {
    return this.finished;
  }
}

class VoteToken extends ERC20 {
  eleccionesRegistradas = [];
  elecciones = [];

  get EleccionesRegistradas() {
    return this.eleccionesRegistradas;
  }

  get Elecciones() {
    return this.elecciones;
  }

  /* set Elecciones(_elecciones) {
    this.elecciones = _elecciones;
  } */

  /*   set EleccionesRegistradas(_eleccionesRegistradas) {
    this.eleccionesRegistradas = _eleccionesRegistradas;
  } */

  async sufragar(ctx, _idEleccion, _lista, _fecha) {
    await this.CheckInitialized(ctx);

    if (ctx && _idEleccion && _lista) {
      const votante = ctx.clientIdentity.getID();

      this.validarExistenciaEleccion(_idEleccion);
      this.validarVotoUnico(_idEleccion, votante);
      this.validarVotoUnicoPorFecha(votante, _fecha);

      const resp = await this.Transfer(ctx, _lista, 1);

      this.elecciones.forEach((eleccion) => {
        if (eleccion.idEleccion === _idEleccion)
          eleccion.votosReceived.push(votante);
      });

      const evento = {
        idEleccion: _idEleccion,
        fecha: _fecha,
        lista: _lista,
      };

      const buffer = Buffer.from(JSON.stringify(evento));

      ctx.stub.setEvent("Voto emitido", buffer);

      return resp;
    } else {
      throw new Error("Argumentos inválidos o faltantes");
    }
  }

  async agregarEleccion(ctx, _idEleccion, _fecha) {
    await this.CheckInitialized(ctx);
    if (ctx && _idEleccion && _fecha) {
      this.validarEleccionRegistrada(_idEleccion);

      const myEleccion = new Eleccion(_idEleccion, _fecha);
      this.elecciones.push(myEleccion);
      this.eleccionesRegistradas.push(myEleccion.idEleccion);

      const evento = {
        idEleccion: _idEleccion,
        fecha: _fecha,
        finished: myEleccion.finished,
      };

      const buffer = Buffer.from(JSON.stringify(evento));
      ctx.stub.setEvent("Elección registrada", buffer);
    } else {
      throw new Error("Argumentos inválidos o faltantes");
    }
  }

  async terminarEleccion(ctx, _idEleccion) {
    await this.CheckInitialized(ctx);
    if (ctx && _idEleccion) {
      this.validarExistenciaEleccion(_idEleccion);
      this.elecciones.forEach((x) => {
        if (x.idEleccion === _idEleccion) {
          x.finished = true;
        }
      });
    } else {
      throw new Error("Argumentos inválidos o faltantes");
    }
  }

  /* VALIDACIONES */
  validarExistenciaEleccion(_idEleccion) {
    const existElection = this.eleccionesRegistradas.some(
      (x) => x === _idEleccion
    );
    if (!existElection) {
      throw new Error("La elección a modificar no existe");
    }
  }

  validarEleccionRegistrada(_idEleccion) {
    const existElection = this.eleccionesRegistradas.some(
      (x) => x === _idEleccion
    );
    if (existElection) {
      throw new Error("La elección a ingresar ya se encuentra registrada");
    }
  }

  async validarVotanteConTokens(ctx, owner) {
    const balance = await this.BalanceOf(ctx, owner);
    if (balance <= 0) {
      throw new Error(
        "El votante no tiene asigando un token BNE para realizar la votación"
      );
    }
  }

  validarVotoUnico(_idEleccion, _votante) {
    this.elecciones.forEach((eleccion) => {
      if (eleccion.idEleccion === _idEleccion) {
        const yaVoto = eleccion.votosReceived.some(
          (votante) => votante === _votante
        );
        if (yaVoto)
          throw new Error("El votante ya ejerció su voto en esta elección");
      }
    });
  }

  validarVotoUnicoPorFecha(_votante, _fecha) {
    this.elecciones.forEach((eleccion) => {
      if (eleccion.fecha == _fecha) {
        const yaVoto = eleccion.votosReceived.some(
          (votante) => votante === _votante
        );
        if (yaVoto)
          throw new Error(
            "El votante ya ejerció su voto en la fecha " + _fecha
          );
      }
    });
  }
}

module.exports = VoteToken;
