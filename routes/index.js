var express = require('express');
var router = express.Router();
/* dodatno */
var pg = require('pg');
var bcrypt = require('bcrypt');
const {resolveInclude} = require("ejs");
const socketIO = require('socket.io');
const http = require('http');

var io = null;
var poruke = [];


const DB_CONNECTION = {
  host: 'cornelius.db.elephantsql.com',
  user: 'djrvmtxp',
  database: 'djrvmtxp',
  password: 'KggOEF8K1q-5PaOHdXg5ia83EDKjCRAm',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}

var pool = new pg.Pool(DB_CONNECTION);

router.get('/404', (req, res) => {
  res.render('404', { title: 'Error' });
});


let pomocne = {
  kriptuj: function (lozinka) {
    var kriptovanaLozinka = bcrypt.hashSync(lozinka, 10).toString();
    return kriptovanaLozinka;
  }
}

let funkcije = {
  provjeriPrijavu: function (req, res, next) {
    var korisnik = {
      email: req.body.email,
      lozinka: req.body.lozinka
    };

    pool.connect(function (err, client, done) {
      if (err) {
        res.end('{"error" : "Error", "status" : 500}');
      }
      client.query(`select k.*, tip from korisnici k left join tip_korisnika tk on k.id = tk.korisnik_id where email = $1`, [korisnik.email], function(err, result) {
        done();

        if (err) {
          res.sendStatus(500);
        }
        else{
          if (result.rows.length === 0) {
            return res.sendStatus(404);
          }

          else{
            let kriptovanaSifra = result.rows[0].lozinka;
            if(bcrypt.compareSync(korisnik.lozinka, kriptovanaSifra)) {
              res.korisnik = {
                id:result.rows[0].id,
                ime: result.rows[0].ime,
                prezime: result.rows[0].prezime,
                email: result.rows[0].email,
                tip: result.rows[0].tip,
              };

              res.cookie('opkn', res.korisnik);
              next();
            }
            else {
              console.info("losa sifra");
              return res.sendStatus(401);
            }
          }
          //req.korisnici = result.rows;
          //next();
        }
      });
    });
  }

}
/* kraj */





/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('home', { title: 'Evidencija projekata' });
});

router.get('/login', function (req, res, next) {
  res.render('login', {title: 'Prijavi se!'});
});

router.post('/login', funkcije.provjeriPrijavu, function (req, res, next) {
  console.info("uspjesno");
  console.info(res.korisnik);
  switch (res.korisnik.tip) {
    case 'radnik':
      res.redirect('./radnik/mojProfil');
      break;
    case 'menadžer':
      res.redirect('./menadzer/mojProfil');
      break;
    case 'admin':
      res.redirect('./users/adminPocetna' );
      break;
    default:
      res.redirect('./users/adminPocetna');
  }

  //res.sendStatus(200);
  res.redirect('./users/adminPocetna');
});

router.get('/logout', (req, res, next) => {
  res.clearCookie('opkn')
  res.render('login', {title: 'Prijavi se!'})
})


function currentDate() {
  const now = new Date();
  return now.toISOString();
}


router.get('/test/ws/:id', function (req, res, next) {
  var id = req.params.id;

  var moj_id = req.cookies.opkn.id;

  pool.connect(function (err, client, done) {
    if (err) {
      console.error(err);
      res.sendStatus(500);
      return;
    }

    var query = `select * from poruke where (posiljalac_id = $1 AND primaoc_id = $2) OR (posiljalac_id = $2 AND primaoc_id = $1)
                order by vrijeme ASC`;

    client.query(query, [moj_id, id], function (err, result) {
      done();
      if (err) {
        console.error(err);
        res.sendStatus(500);
        return;
      }

      // var porukeIzBaze = result.rows.map(row => row.tekst_poruke);

      var porukeIzBaze = result.rows.map(row => {
        return {
          tekst_poruke: row.tekst_poruke,
          vrijeme: row.vrijeme,
          posiljalac_id: row.posiljalac_id,
          primalac_id: row.primalac_id
        };
      });


      if (!io) {

        io = require('socket.io')(req.connection.server);

        io.on('connection', function (client) {
          console.info('konektovan');

          client.emit(`sve_poruke_${id}`, porukeIzBaze.toString());

          client.on('disconnect', function () {
            console.log('disconnected event');
          });

          client.on('klijent_salje_poruku', function (d, id1, id2) {

            const novaPoruka = {
              tekst_poruke: d,
              vrijeme: currentDate(),
              posiljalac_id: id2,
              primalac_id: id1
            };



            porukeIzBaze.push(novaPoruka);
            poruke.push(novaPoruka);
            pool.connect(function (err, client, done) {
              if (err) {
                console.error(err);
                res.end('{"error" : "Error", "status" : 500}');
              }
              client.query(`insert into poruke (posiljalac_id, tekst_poruke, vrijeme, primaoc_id) values ($1, $2, $3, $4)`, [id2, d, currentDate(), id1], function (err, result) {
                done();
                if (err) {
                  console.info(err);
                  res.sendStatus(500);
                } else {
                  io.emit('poruka_sa_servera', novaPoruka);
                }
              });
            });
          })
        });
      }
      res.render('chatPoruke2', { title: 'IT', id: id, moj_id: moj_id, poruke: porukeIzBaze});
    });
  });
});




module.exports = router;
