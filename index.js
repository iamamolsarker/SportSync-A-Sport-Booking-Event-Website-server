const express = require('express');
const app = express();
const cors = require('cors');

const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8');
const serviceAccount = JSON.parse(decoded);

require('dotenv').config()
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

//middleware 
app.use(express.json());
app.use(cors());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eep15as.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// verify firebase token
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  
  if(!authHeader || !authHeader.startsWith("Bearer ")){
    return res.status(401).send({message: 'unauthorized access'})
  }

  const token = authHeader.split(' ')[1];

  try{
    const decoded = await admin.auth().verifyIdToken(token);
    console.log('amol amol aam aam', decoded);
    req.decoded = decoded;
    next();
  }
  catch(error){
    return res.status(401).send({message: 'unauthorized access'});
  }
}

const verifyTokenEmail = (req, res, next) => {
  if(req.query.email !== req.decoded.email){
    return res.status(403).send({message: 'forbidden access'});
  }
  next();
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const eventCollection = client.db("sportSync").collection("events");
    const bookingCollection = client.db("sportSync").collection("bookings");

    //get all events & query by user email in one route

    app.get("/events/private", verifyFirebaseToken, verifyTokenEmail, async (req,res) => {
      const email = req.query.email;
      const query = {creatorEmail: email}
      const result = await eventCollection.find(query).toArray();
      res.send(result)
    })
    //public route
    app.get("/events",  async (req,res) => {
      const email = req.query.email;
      const query = {status: "available"}
      const result = await eventCollection.find(query).toArray();
      res.send(result)
    })

    //get featured events

    app.get("/events/featured", async (req, res) => {
      const filter = {status : "available"}
      const options = {
        sort:{deadline: 1},
      }
      const result = await eventCollection.find(filter, options).limit(6).toArray();
      res.send(result);
    })

    //get events by id

    app.get("/events/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await eventCollection.findOne(query);
      res.send(result);
    })

    //post event by organizer

    app.post("/events", async (req, res) => {
      const eventData = req.body;
      const result = await eventCollection.insertOne(eventData);
      res.send(result)
    })

    //update event
    app.put("/events/:id" , async (req, res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)};
      const updatedData = req.body;
      const updatedoc = {
        $set: updatedData
      }
      const result = await eventCollection.updateOne(filter, updatedoc);
      res.send(result)
    })

    // delete events by organizer

    app.delete("/events/:id", async (req, res) => {
      const id = req.params.id;
      const eventQuery = {_id: new ObjectId(id)}
      const bookingQuery = {eventId: id}
      const deleteEvent = await eventCollection.deleteOne(eventQuery);
      const deleteBooking = await bookingCollection.deleteMany(bookingQuery);
      res.send(deleteEvent, deleteBooking);
    })

    //get my bookings by user email

    app.get("/event-bookings", verifyFirebaseToken, verifyTokenEmail, async (req, res) => {
      const email = req.query.email;
      const query = {bookedBy: email};
      const result = await bookingCollection.find(query).toArray();
      for(const booking of result){
        const eventId = booking.eventId;
        const eventQuery = {_id: new ObjectId(eventId)}
        const event = await eventCollection.findOne(eventQuery)
        booking.eventImage = event.eventImage;
        booking.eventName = event.eventName;
        booking.eventDate = event.eventDate;
        booking.eventType = event.eventType;
        booking.location = event.location;
      }
      res.send(result)
    })

    //post bookings by user email
    app.post("/event-bookings/", async (req, res) => {
      const {bookedBy, eventId} = req.body;

      const existedBooking = await bookingCollection.findOne({bookedBy, eventId})
      if(existedBooking){
        return res.status(400).send({
          success: false,
          message: "You have already booked this event!"
        })
      }

      const bookingData = req.body
      const result = await bookingCollection.insertOne(bookingData);
      res.send(result);

    })

    //delete my bookings

    app.delete("/event-bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('sportSync server is ready!');
})

app.listen(port, () => {
    console.log('Server is  running on ', port);
})