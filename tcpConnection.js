const ClientStatus = {
  SYN_SENT: "SYN_SENT",
  CLIENT_CONNECT_ESTABLISHED: "CLIENT_CONNECT_ESTABLISHED",
};
const ServerStatus = {
  SYN_RCEIVE: "SYN_RCEIVE",
  SERVER_CONNECT_ESTABLISHED: "SERVER_CONNECT_ESTABLISHED",
};

const TO_SERVER_MESSAGE = "to-server-message";
const TO_CLIENT_MESSAGE = "to-client-message";
class Wire {
  client = null;
  server = null;
  post(eventName, number, message) {
    if (eventName === TO_CLIENT_MESSAGE) {
      if (!this.client || this.client.number !== number) return;
      setTimeout(() => {
        this.client.receive(message, this.server.number);
      }, 100);
    } else {
      if (!this.server || this.server.number !== number) return;
      setTimeout(() => {
        this.server.receive(message, this.client.number);
      }, 100);
    }
  }
}

class Server {
  number = null;
  constructor() {
    this.wires = [];
    this.number = Math.random();
    this.clients = {};
    this.postDataPromiseCallBack = null;
  }

  postDataToClient(clientNumber, message) {
    const wire = this.wires.find(
      (e) => e.client && e.client.number === clientNumber
    );
    if (wire) {
      wire.post(TO_CLIENT_MESSAGE, clientNumber, message);
    } else {
      console.error("没有找到客户端 " + clientNumber);
    }
  }
  listen(wire) {
    wire.server = this;
    this.wires.push(wire);
  }
  receive(messageFromClient, clientNumber) {
    const SYNValue = Utils.getValue("SYN", messageFromClient);
    if (SYNValue === "1") {
      const seqValue = Utils.getValue("Seq", messageFromClient);
      const obj = {
        clientNumber: clientNumber,
        clientSeq: seqValue,
        serverSeq: 1,
        status: ServerStatus.SYN_RCEIVE,
      };
      this.clients[clientNumber] = obj;
      this.postDataToClient(
        clientNumber,
        `SYN=1 ACK=1 ack=${Number(seqValue) + 1} Seq=${obj.serverSeq}`
      );
      return;
    }

    const obj = this.clients[clientNumber];
    if (!obj) return;
    if (obj.status === ServerStatus.SYN_RCEIVE) {
      const ACKValue = Utils.getValue("ACK", messageFromClient);
      const ackValue = Utils.getValue("ack", messageFromClient);
      const seqValue = Utils.getValue("Seq", messageFromClient);
      if (ACKValue !== "1") return;
      if (!obj) return;
      if (Number(ackValue) === obj.serverSeq + 1) {
        obj.clientSeq = seqValue;
        obj.status = ServerStatus.SERVER_CONNECT_ESTABLISHED;
      }
      return;
    }

    if (obj.status === ServerStatus.SERVER_CONNECT_ESTABLISHED) {
      console.log(`从客户端${clientNumber}接受到的数据：`, messageFromClient);
    }
  }
}

class Client {
  constructor() {
    this.status = null;
    this.wire = null;
    this.number = Math.random();
    this.seq = 1;
    this.serverNumber = null;
    this.connectingPromiseCallBack = null;
  }
  connect(wire, serverNum) {
    this.wire = wire;
    this.serverNumber = serverNum;
    wire.client = this;
    this.status = ClientStatus.SYN_SENT;
    const sendText = "SYN=1 Seq=" + this.seq;
    // SYN=1 Seq=x
    wire.post(TO_SERVER_MESSAGE, serverNum, sendText);
    return new Promise((res) => {
      this.connectingPromiseCallBack = res;
    });
  }
  postDataToServer(message) {
    if (this.wire) {
      this.wire.post(TO_SERVER_MESSAGE, this.serverNumber, message);
    } else {
      if (this.status !== ClientStatus.CLIENT_CONNECT_ESTABLISHED) {
        console.error("没有连接到服务端");
      } else {
        console.error("正在连接中");
      }
    }
  }
  receive(messageFromServer) {
    const SYNValue = Utils.getValue("SYN", messageFromServer);
    if (this.status === ClientStatus.SYN_SENT && SYNValue === "1") {
      // SYN=1 ACK=1 ack=x+1 Seq=y
      const ackValue = Utils.getValue("ack", messageFromServer);
      const seqValue = Utils.getValue("Seq", messageFromServer);

      if (ackValue === this.seq + 1 + "") {
        const sendToServerText = `ACK=1 Seq=${this.seq++} ack=${
          Number(seqValue) + 1
        }`;
        this.wire.post(TO_SERVER_MESSAGE, this.serverNumber, sendToServerText);
        this.status = ClientStatus.CLIENT_CONNECT_ESTABLISHED;
        this.connectingPromiseCallBack();
      }
      return;
    }

    if (this.status === ClientStatus.CLIENT_CONNECT_ESTABLISHED) {
      console.log(
        `从服务器${this.serverNumber}接受到的数据：`,
        messageFromServer
      );
    }
  }
}

const Utils = {
  getValue(key, str = "") {
    let i = 0;
    while (i < str.length) {
      let k = 0;
      if (str.charAt(i) === key.charAt(0)) {
        let isFinded = true;
        let tempi = i;
        while (k < key.length && i + k < str.length) {
          if (str.charAt(i) !== key.charAt(k)) {
            isFinded = false;
            i = tempi;
            break;
          }
          k++;
          i++;
        }
        if (isFinded) {
          i++;
          let result = "";
          while (i < str.length && str.charAt(i) !== " ") {
            result += str.charAt(i);
            i++;
          }

          return result;
        }
      }
      i++;
    }

    return "";
  },
};
