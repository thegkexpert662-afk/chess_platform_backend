import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import {env} from './config/env.js';
import routes from './routes/index.js';
import {notFound,errorHandler} from './middleware/error-handler.js';

const app=express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin: env.corsOrigins.length ? env.corsOrigins : false,
  credentials: true
}));
app.use(express.json({limit:'32kb'}));
app.use(rateLimit({windowMs:60_000,max:120,standardHeaders:true,legacyHeaders:false}));

app.get('/',(req,res)=>{
  res.json({name:'Chess Platform Backend',version:'1.0.0'});
});
app.use('/api',routes);
app.use(notFound);
app.use(errorHandler);

app.listen(env.port,()=>{
  console.log('Chess backend listening on port '+env.port);
});
