const assert = require("assert");

const { Context } = require("fabric-contract-api");
const { ChaincodeStub, ClientIdentity } = require("fabric-shim");

const VoteToken = require("../src/VoteToken.js");

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinon = require("sinon");
const expect = chai.expect;

chai.should();
chai.use(chaiAsPromised);

describe("VotacionesToken", () => {
  let sandbox;
  let token;
  let ctx;
  let mockStub;
  let mockClientIdentity;
  let testRan = 0;

  before("Sandbox creation", async () => {
    sandbox = sinon.createSandbox();

    token = new VoteToken();
    ctx = sinon.createStubInstance(Context);
    mockStub = sinon.createStubInstance(ChaincodeStub);
    ctx.stub = mockStub;
    mockClientIdentity = sinon.createStubInstance(ClientIdentity);
    mockClientIdentity.getMSPID.returns("Org1MSP");

    ctx.clientIdentity = mockClientIdentity;

    await token.Initialize(ctx, "Ballot Nueva Esperanza", "BNE", "0");

    mockStub.putState.resolves("contrato inicializado");
    mockStub.setEvent.returns("datos del contrato");
  });

  beforeEach("Sandbox creation Each", async () => {
    sandbox = sinon.createSandbox();
    testRan++;
    console.log("Running test " + testRan);
  });

  afterEach("Sandbox restoration", async () => {
    sandbox.restore();
  });

  describe("#TokenName", () => {
    it("Token name test succesfully", async () => {
      mockStub.getState.resolves("Ballot Nueva Esperanza");

      const response = await token.TokenName(ctx);

      sinon.assert.calledWith(mockStub.getState, "name");
      expect(response).to.equals("Ballot Nueva Esperanza");
    });
  });

  describe("#Symbol", () => {
    it("Token symbol test succesfully", async () => {
      mockStub.getState.resolves("BNE");

      const response = await token.Symbol(ctx);
      sinon.assert.calledWith(mockStub.getState, "symbol");
      expect(response).to.equals("BNE");
    });
  });

  describe("#Decimals", () => {
    it("Token decimals test succesfully", async () => {
      mockStub.getState.resolves(Buffer.from("0"));

      const response = await token.Decimals(ctx);
      sinon.assert.calledWith(mockStub.getState, "decimals");
      expect(response).to.equals(0);
    });
  });

  describe("#TotalSupply", () => {
    it("Total supply test succesfully", async () => {
      mockStub.getState.resolves(Buffer.from("1000000"));

      const response = await token.TotalSupply(ctx);
      sinon.assert.calledWith(mockStub.getState, "totalSupply");
      expect(response).to.equals(1000000);
    });
  });

  describe("#BalanceOf", () => {
    it("Balance of test succesfully", async () => {
      mockStub.createCompositeKey.returns("balance_Jane");
      mockStub.getState.resolves(Buffer.from("1000000"));

      const response = await token.BalanceOf(ctx, "Jane");
      expect(response).to.equals(1000000);
    });
  });

  describe("#ClientAccountID", () => {
    it("should work", async () => {
      mockClientIdentity.getID.returns("x509::{subject DN}::{issuer DN}");

      const response = await token.ClientAccountID(ctx);
      console.log(mockClientIdentity.getID.callCount);
      sinon.assert.calledOnce(mockClientIdentity.getID);
      expect(response).to.equals("x509::{subject DN}::{issuer DN}");
    });
  });
  describe("#_transfer", () => {
    it("should fail when the sender and the receipient are the same", async () => {
      await expect(
        token._transfer(ctx, "Alice", "Alice", "1000")
      ).to.be.rejectedWith(
        Error,
        "cannot transfer to and from same client account"
      );
    });

    it("should fail when the sender does not have enough token", async () => {
      mockStub.createCompositeKey
        .withArgs("balance", ["Alice"])
        .returns("balance_Alice");
      mockStub.getState.withArgs("balance_Alice").resolves(Buffer.from("500"));

      await expect(
        token._transfer(ctx, "Alice", "Bob", "1000")
      ).to.be.rejectedWith(
        Error,
        "client account Alice has insufficient funds."
      );
    });

    it("should transfer to a new account when the sender has enough token", async () => {
      mockStub.createCompositeKey
        .withArgs("balance", ["Alice"])
        .returns("balance_Alice");
      mockStub.getState.withArgs("balance_Alice").resolves(Buffer.from("1000"));

      mockStub.createCompositeKey
        .withArgs("balance", ["Bob"])
        .returns("balance_Bob");
      mockStub.getState.withArgs("balance_Bob").resolves(null);

      const response = await token._transfer(ctx, "Alice", "Bob", "1000");
      sinon.assert.calledWith(
        mockStub.putState,
        "balance_Alice",
        Buffer.from("0")
      );
      sinon.assert.calledWith(
        mockStub.putState,
        "balance_Bob",
        Buffer.from("1000")
      );
      expect(response).to.equals(true);
    });

    it("should transfer to the existing account when the sender has enough token", async () => {
      mockStub.createCompositeKey
        .withArgs("balance", ["Alice"])
        .returns("balance_Alice");
      mockStub.getState.withArgs("balance_Alice").resolves(Buffer.from("1000"));

      mockStub.createCompositeKey
        .withArgs("balance", ["Bob"])
        .returns("balance_Bob");
      mockStub.getState.withArgs("balance_Bob").resolves(Buffer.from("2000"));

      const response = await token._transfer(ctx, "Alice", "Bob", "1000");
      sinon.assert.calledWith(
        mockStub.putState,
        "balance_Alice",
        Buffer.from("0")
      );
      sinon.assert.calledWith(
        mockStub.putState,
        "balance_Bob",
        Buffer.from("3000")
      );
      expect(response).to.equals(true);
    });
  });

  describe("#Transfer", () => {
    it("should work", async () => {
      mockClientIdentity.getID.returns("Alice");
      sinon.stub(token, "_transfer").returns(true);

      const response = await token.Transfer(ctx, "Bob", "1000");
      const event = { from: "Alice", to: "Bob", value: 1000 };
      sinon.assert.calledWith(
        mockStub.setEvent,
        "Transfer",
        Buffer.from(JSON.stringify(event))
      );
      expect(response).to.equals(true);
    });
  });

  describe("#TransferFrom", () => {
    it("should fail when the spender is not allowed to spend the token", async () => {
      mockClientIdentity.getID.returns("Charlie");

      mockStub.createCompositeKey
        .withArgs("allowance", ["Alice", "Charlie"])
        .returns("allowance_Alice_Charlie");
      mockStub.getState
        .withArgs("allowance_Alice_Charlie")
        .resolves(Buffer.from("0"));

      await expect(
        token.TransferFrom(ctx, "Alice", "Bob", "1000")
      ).to.be.rejectedWith(
        Error,
        "The spender does not have enough allowance to spend."
      );
    });

    it("should transfer when the spender is allowed to spend the token", async () => {
      mockClientIdentity.getID.returns("Charlie");

      mockStub.createCompositeKey
        .withArgs("allowance", ["Alice", "Charlie"])
        .returns("allowance_Alice_Charlie");
      mockStub.getState
        .withArgs("allowance_Alice_Charlie")
        .resolves(Buffer.from("3000"));

      //sinon.stub(token, "_transfer").returns(true);

      const response = await token.TransferFrom(ctx, "Alice", "Bob", "1000");
      sinon.assert.calledWith(
        mockStub.putState,
        "allowance_Alice_Charlie",
        Buffer.from("2000")
      );
      const event = { from: "Alice", to: "Bob", value: 1000 };
      sinon.assert.calledWith(
        mockStub.setEvent,
        "Transfer",
        Buffer.from(JSON.stringify(event))
      );
      expect(response).to.equals(true);
    });
  });

  describe("#Approve", () => {
    it("should work", async () => {
      mockClientIdentity.getID.returns("Dave");
      mockStub.createCompositeKey.returns("allowance_Dave_Eve");

      const response = await token.Approve(ctx, "Ellen", "1000");
      sinon.assert.calledWith(
        mockStub.putState,
        "allowance_Dave_Eve",
        Buffer.from("1000")
      );
      expect(response).to.equals(true);
    });
  });

  describe("#Allowance", () => {
    it("should work", async () => {
      mockStub.createCompositeKey.returns("allowance_Dave_Eve");
      mockStub.getState.resolves(Buffer.from("1000"));

      const response = await token.Allowance(ctx, "Dave", "Eve");
      expect(response).to.equals(1000);
    });
  });

  describe("#Initialize", () => {
    it("should work", async () => {
      // We consider it has already been initialized in the before-each statement
      sinon.assert.calledWith(
        mockStub.putState,
        "name",
        Buffer.from("Ballot Nueva Esperanza")
      );
      sinon.assert.calledWith(mockStub.putState, "symbol", Buffer.from("BNE"));
      sinon.assert.calledWith(mockStub.putState, "decimals", Buffer.from("0"));
    });

    it("should failed if called a second time", async () => {
      // We consider it has already been initialized in the before-each statement
      await expect(
        token.Initialize(ctx, "Ballot Nueva Esperanza", "BNE", "0")
      ).to.be.rejectedWith(
        Error,
        "contract options are already set, client is not authorized to change them"
      );
    });
  });

  describe("#Mint", () => {
    it("should add token to a new account and a new total supply", async () => {
      mockClientIdentity.getMSPID.returns("Org1MSP");
      mockClientIdentity.getID.returns("Alice");
      mockStub.createCompositeKey.returns("balance_Alice");
      mockStub.getState.withArgs("balance_Alice").resolves(null);
      mockStub.getState.withArgs("totalSupply").resolves(null);

      const response = await token.Mint(ctx, "1000");
      sinon.assert.calledWith(
        mockStub.putState,
        "balance_Alice",
        Buffer.from("1000")
      );
      sinon.assert.calledWith(
        mockStub.putState,
        "totalSupply",
        Buffer.from("1000")
      );
      expect(response).to.equals(true);
    });

    it("should add token to the existing account and the existing total supply", async () => {
      mockClientIdentity.getMSPID.returns("Org1MSP");
      mockClientIdentity.getID.returns("Alice");
      mockStub.createCompositeKey.returns("balance_Alice");
      mockStub.getState.withArgs("balance_Alice").resolves(Buffer.from("1000"));
      mockStub.getState.withArgs("totalSupply").resolves(Buffer.from("2000"));

      const response = await token.Mint(ctx, "1000");
      sinon.assert.calledWith(
        mockStub.putState,
        "balance_Alice",
        Buffer.from("2000")
      );
      sinon.assert.calledWith(
        mockStub.putState,
        "totalSupply",
        Buffer.from("3000")
      );
      expect(response).to.equals(true);
    });

    it("should add token to a new account and the existing total supply", async () => {
      mockClientIdentity.getMSPID.returns("Org1MSP");
      mockClientIdentity.getID.returns("Alice");
      mockStub.createCompositeKey.returns("balance_Alice");
      mockStub.getState.withArgs("balance_Alice").resolves(null);
      mockStub.getState.withArgs("totalSupply").resolves(Buffer.from("2000"));

      const response = await token.Mint(ctx, "1000");
      sinon.assert.calledWith(
        mockStub.putState,
        "balance_Alice",
        Buffer.from("1000")
      );
      sinon.assert.calledWith(
        mockStub.putState,
        "totalSupply",
        Buffer.from("3000")
      );
      expect(response).to.equals(true);
    });
  });

  describe("#Burn", () => {
    it("should work", async () => {
      mockClientIdentity.getMSPID.returns("Org1MSP");
      mockClientIdentity.getID.returns("Alice");
      mockStub.createCompositeKey.returns("balance_Alice");
      mockStub.getState.withArgs("balance_Alice").resolves(Buffer.from("1000"));
      mockStub.getState.withArgs("totalSupply").resolves(Buffer.from("2000"));

      const response = await token.Burn(ctx, "1000");
      sinon.assert.calledWith(
        mockStub.putState,
        "balance_Alice",
        Buffer.from("0")
      );
      sinon.assert.calledWith(
        mockStub.putState,
        "totalSupply",
        Buffer.from("1000")
      );
      expect(response).to.equals(true);
    });
  });

  describe("#ClientAccountBalance", () => {
    it("should work", async () => {
      mockClientIdentity.getID.returns("Alice");
      mockStub.createCompositeKey.returns("balance_Alice");
      mockStub.getState.resolves(Buffer.from("1000"));

      const response = await token.ClientAccountBalance(ctx);
      expect(response).to.equals(1000);
    });
  });

  describe("#Token management", () => {
    it("Enviar token test succesfully", async () => {
      mockClientIdentity.getID.returns("Jane");
      //sinon.stub(token, "_transfer").returns(true);

      const response = await token.Transfer(ctx, "Bob", "1");
      const event = { from: "Jane", to: "Bob", value: 1 };
      sinon.assert.calledWith(
        mockStub.setEvent,
        "Transfer",
        Buffer.from(JSON.stringify(event))
      );
      expect(response).to.equals(true);
    });
  });

  describe("#Votation process", () => {
    it("Agregar eleccion test succesfully", async () => {
      const idEleccion = 1;
      const fecha = "30/04/2023";
      const finished = false;
      const buffer = Buffer.from(
        JSON.stringify({ idEleccion, fecha, finished })
      );

      await token.agregarEleccion(ctx, idEleccion, fecha, finished);
      const response = await token.EleccionesRegistradas.some(
        (x) => x === idEleccion
      );

      expect(response).to.equals(true);

      const response2 = await token.Elecciones.some(
        (x) => (x.idEleccion = idEleccion)
      );

      expect(response2).to.equals(true);

      sinon.assert.calledWith(mockStub.setEvent, "Elección registrada", buffer);
    });

    it("Evitar elección duplicada", async () => {
      const idEleccion2 = 1;
      const fecha2 = "30/04/2023";
      const finished = false;

      await expect(
        token.agregarEleccion(ctx, idEleccion2, fecha2, finished)
      ).to.be.rejectedWith(
        Error,
        "La elección a ingresar ya se encuentra registrada"
      );
    });

    it("Terminar elección test succesfully", async () => {
      const idEleccion = 1;

      await token.terminarEleccion(ctx, idEleccion);
      const eleccion = await token.Elecciones.find(
        (x) => x.idEleccion === idEleccion
      );
      expect(eleccion.Finished).to.equals(true);
    });

    it("Sufragar test succesfully", async () => {
      mockClientIdentity.getID.returns("Jose");
      const idEleccion = 1;
      const lista = 1;
      const fecha = "30/04/2023";
      const siSufrago = await token.sufragar(ctx, idEleccion, lista, fecha);

      expect(siSufrago).to.equals(true);

      const registro = await token.Elecciones.find(
        (d) => d.idEleccion === idEleccion
      );
      const votoRegistrado = registro.VotosReceived.some(
        (votante) => votante === "Jose"
      );
      expect(votoRegistrado).to.equals(true);
    });

    it("Deberia fallar por voto doble", async () => {
      mockClientIdentity.getID.returns("Maria");
      const idEleccion = 1;
      const lista = 1;
      const fecha = "30/04/2023";
      await token.sufragar(ctx, idEleccion, lista, fecha);

      const idEleccion2 = 1;
      const lista2 = 2;
      const fecha2 = "30/04/2023";
      await expect(
        token.sufragar(ctx, idEleccion2, lista2, fecha2)
      ).to.be.rejectedWith(
        Error,
        "El votante ya ejerció su voto en esta elección"
      );
    });

    it("Deberia fallar por voto doble de acuerdo con una fecha dada", async () => {
      mockClientIdentity.getID.returns("Pedro");
      const idEleccion = 1;
      const lista = 1;
      const finished = false;
      const fecha = "30/04/2023";

      await token.sufragar(ctx, idEleccion, lista, fecha);

      const idEleccion2 = 2;

      await token.agregarEleccion(ctx, idEleccion2, fecha, finished);

      await expect(
        token.sufragar(ctx, idEleccion2, 2, fecha)
      ).to.be.rejectedWith(
        Error,
        "El votante ya ejerció su voto en la fecha " + fecha
      );
    });
  });
});
