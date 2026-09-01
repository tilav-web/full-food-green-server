import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets"
import { Server, Socket } from "socket.io"
import { Injectable, Logger } from "@nestjs/common"

@Injectable()
@WebSocketGateway({
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger("OrdersGateway")

  handleConnection(client: Socket) {
    this.logger.log(`WebSocket client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WebSocket client disconnected: ${client.id}`)
  }

  // Client (User) joins specific order room to track order in real-time
  @SubscribeMessage("join_order")
  handleJoinOrder(
    @MessageBody() data: { orderId: string },
    @ConnectedSocket() client: Socket
  ) {
    if (data?.orderId) {
      const room = `order_${data.orderId}`
      client.join(room)
      this.logger.log(`Client ${client.id} joined ${room}`)
      return { status: "joined", room }
    }
  }

  // Cashier POS joins cashier room to receive new orders & receipt updates
  @SubscribeMessage("join_cashier")
  handleJoinCashier(@ConnectedSocket() client: Socket) {
    client.join("cashier_room")
    this.logger.log(`Client ${client.id} joined cashier_room`)
    return { status: "joined", room: "cashier_room" }
  }

  // Admin joins admin room for live dashboard updates
  @SubscribeMessage("join_admin")
  handleJoinAdmin(@ConnectedSocket() client: Socket) {
    client.join("admin_room")
    this.logger.log(`Client ${client.id} joined admin_room`)
    return { status: "joined", room: "admin_room" }
  }

  // Emit when a new order is created
  emitNewOrder(order: any) {
    this.logger.log(`Emitting new_order for order #${order.id}`)
    this.server.to("cashier_room").emit("new_order", order)
    this.server.to("admin_room").emit("new_order", order)
  }

  // Emit when an order is updated (status change, taxi call, receipt verified, etc.)
  emitOrderUpdated(order: any) {
    this.logger.log(`Emitting order_updated for order #${order.id} (Status: ${order.status})`)
    // Notify cashier & admin
    this.server.to("cashier_room").emit("order_updated", order)
    this.server.to("admin_room").emit("order_updated", order)
    // Notify customer in order room
    this.server.to(`order_${order.id}`).emit("order_updated", order)
    this.server.to(`order_${order.id}`).emit("order_status_updated", {
      orderId: order.id,
      status: order.status,
      order,
    })
  }
}
