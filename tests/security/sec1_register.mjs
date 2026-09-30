import net from "node:net";
import { register } from "node:module";

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function blockedConnect() {
  void connect;
  throw new Error("egress-blocked");
};

register(new URL("./sec1_ts_loader.mjs", import.meta.url));
