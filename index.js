const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

// middleware
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "https://skillup-57533.web.app",
            "https://skillup-57533.firebaseapp.com",
        ],
        credentials: true,
    })
);
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nfgpaoq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const userCollection = client.db("skillupDB").collection("users");
        const teacherRequestCollection = client.db("skillupDB").collection("teacherRequests");
        const courseCollection = client.db("skillupDB").collection("courses");
        const paymentCollection = client.db("skillupDB").collection("payments");
        const enrollCollection = client.db("skillupDB").collection("enrolls");
        const assignmentCollection = client.db("skillupDB").collection("assignments");
        const feedbackCollection = client.db("skillupDB").collection("feedbacks");

        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })


        // middlewares 
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Unauthorized Access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Unauthorized Access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
            next();
        }

        const verifyTeacher = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isTeacher = user?.role === 'teacher';
            if (!isTeacher) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }
            next();
        }

        // user related api
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });
        // change korchi... verifyAdmin bad dichi
        app.get('/users/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            res.send(user);
        });
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })
        app.get('/users/teacher/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let teacher = false;
            if (user) {
                teacher = user?.role === 'teacher';
            }
            res.send({ teacher });
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const isUserExist = await userCollection.findOne(query);
            if (isUserExist) {
                return res.send({ message: 'Existing User', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        app.patch('/users/:email', verifyToken, verifyAdmin, async (req, res) => {
            const data = req.body;
            // console.log(typeof data.role);
            const email = req.params.email;
            const filter = { email: email }
            const updatedDoc = {
                $set: {
                    role: data.role
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })

        // teacher related api
        app.get('/teacherRequests', verifyToken, verifyAdmin, async (req, res) => {
            const result = await teacherRequestCollection.find().toArray();
            res.send(result);
        })
        app.get('/teacherRequests/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await teacherRequestCollection.find(query).toArray();
            res.send(result);
        })
        app.post('/teacherRequests', verifyToken, async (req, res) => {
            const teacher = req.body;
            const result = await teacherRequestCollection.insertOne(teacher);
            // console.log(teacher);
            res.send(result);
        })
        app.patch('/teacherRequests/:id', verifyToken, verifyAdmin, async (req, res) => {
            const data = req.body;
            // console.log(typeof data.status);
            const id = req.params.id;
            // console.log("id: ", id);
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: data.status
                }
            }
            const result = await teacherRequestCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })


        // Course related api
        app.get('/courses', verifyToken, verifyAdmin, async (req, res) => {
            const result = await courseCollection.find().toArray();
            res.send(result);
        })
        app.get('/courses/update/:id', verifyToken, verifyTeacher, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await courseCollection.findOne(query);
            res.send(result);
        })
        app.get('/courses/valid-courses', async (req, res) => {
            // const data = req.body;
            const query = { status: 'approved' }
            const result = await courseCollection.find(query).toArray();
            res.send(result);
        })
        app.get('/courses/valid-courses/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await courseCollection.findOne(query);
            res.send(result);
        })
        app.get('/users/teacher/myCourses/:email', verifyToken, verifyTeacher, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await courseCollection.find(query).toArray();
            res.send(result);
        })
        app.post('/courses', verifyToken, verifyTeacher, async (req, res) => {
            const course = req.body;
            const result = await courseCollection.insertOne(course);
            // console.log(course);
            res.send(result);
        })
        app.patch('/courses/:id', verifyToken, verifyAdmin, async (req, res) => {
            const data = req.body;
            // console.log(typeof data.status);
            const id = req.params.id;
            // console.log("id: ", id);
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: data.status
                }
            }
            const result = await courseCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })
        app.patch('/courses/update/:id', verifyToken, verifyTeacher, async (req, res) => {
            const data = req.body;
            // console.log(typeof data.status);
            const id = req.params.id;
            // console.log("id: ", id);
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    name: data.name,
                    email: data.email,
                    title: data.title,
                    courseImage: data.courseImage,
                    price: data.price,
                    description: data.description,
                }
            }
            const result = await courseCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })

        app.delete('/courses/:id', verifyToken, verifyTeacher, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await courseCollection.deleteOne(query);
            res.send(result);
        })

        // Enrolls related api
        app.get('/enrolls/course/:id', async (req, res) => {
            const id = req.params.id;
            const query = { courseId: id };
            const result = await enrollCollection.find(query).toArray();
            // console.log(result);
            res.send(result);
        })
        app.get('/enrolls/student/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { studentEmail: email };
            const result = await enrollCollection.find(query).toArray();
            res.send(result);
        })
        app.post('/enrolls', async (req, res) => {
            const enrollInfo = req.body;
            const result = await enrollCollection.insertOne(enrollInfo)
            res.send(result);
        })

        // assignment related api
        app.get('/assignments/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { courseId: id }
            const result = await assignmentCollection.find(query).sort({ publishDate: -1 }).toArray()
            res.send(result);
        })
        app.post('/assignments', verifyToken, verifyTeacher, async (req, res) => {
            const assignmentInfo = req.body;
            const result = await assignmentCollection.insertOne(assignmentInfo);
            res.send(result);
        })
        app.patch('/assignments/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    submissionCount: data.submissionCount
                }
            }
            const result = await assignmentCollection.updateOne(filter, updatedDoc)
            res.send(result);
        })

        // feedback related api
        app.get('/feedbacks', async (req, res) => {
            const result = await feedbackCollection.find().toArray();
            res.send(result);
        })
        app.post('/feedbacks', verifyToken, async (req, res) => {
            const data = req.body;
            const result = await feedbackCollection.insertOne(data);
            res.send(result);
        })



        // payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            // console.log(amount, 'amount inside the intent');

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        });

        // payment related api
        app.post('/payments', verifyToken, async (req, res) => {
            const payment = req.body;
            const result = await paymentCollection.insertOne(payment);
            res.send(result);
        })

        // stats
        app.get('/stats', async (req, res) => {
            const users = await userCollection.estimatedDocumentCount();
            const enrolls = await enrollCollection.estimatedDocumentCount();
            const assignment = await assignmentCollection.estimatedDocumentCount();
            res.send({
                users,
                enrolls,
                assignment
            })
        })



        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('SkillUp is running')
})

app.listen(port, () => {
    console.log(`SkillUp is running  on port ${port}`);
})