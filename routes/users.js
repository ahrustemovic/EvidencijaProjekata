var express = require('express');
var router = express.Router();
var pg = require('pg');
var bcrypt = require('bcrypt');
const {resolveInclude} = require("ejs");
const nodemailer = require('nodemailer');


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

let pomocne = {
  kriptuj: function (lozinka) {
    var kriptovanaLozinka = bcrypt.hashSync(lozinka, 10).toString();
    return kriptovanaLozinka;
  }
}


let db = {
  registrujKorisnika: function (req, res, next) {
    var korisnik = {
      ime: req.body.ime,
      prezime: req.body.prezime,
      email: req.body.email,
      lozinka: req.body.lozinka,
      uloga: req.body.uloga
    };
    // var transporter = nodemailer.createTransport({
    //   service: 'gmail',
    //   auth: {
    //     user: 'anesa.node@gmail.com',
    //     pass: 'anesa2023'
    //   }
    // });
    //
    // var mailOptions = {
    //   from: 'anesa.node@gmail.com',
    //   to: 'ajsa.isanovic@gmail.com',
    //   subject: 'Korisnicki racun kreiran!',
    //   text: 'Vaša lozinka je ${req.korisnik.lozinka}.'
    // };
    //
    // transporter.sendMail(mailOptions, function(error, info){
    //   if (error) {
    //     console.log(error);
    //   } else {
    //     console.log('Email sent: ' + info.response);
    //   }
    // });

    nodemailer.createTestAccount((err, account) => {
      if (err) {
        console.error('Failed to create a testing account. Check your nodemailer configuration.');
        return;
      }

      // Create a transporter with the test account
      const transporter = nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
          user: account.user,
          pass: account.pass,
        },
      });

      // Your email options
      const mailOptions = {
        from: 'anesa.node@gmail.com',
        to: korisnik.email,
        subject: 'Korisnicki racun kreiran!',
        text: `Vaša lozinka je ${korisnik.lozinka}.`,
      };

      // Send mail with defined transport object
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          return console.log(error);
        }

        // Log the ethereal.email URL where you can view the sent email
        console.log('Preview URL: ' + nodemailer.getTestMessageUrl(info));
      });
    });


    pool.connect(function (err, client, done) {
      if (err) {
        res.end('{"error" : "Error", "status" : 500}');
      }
      client.query(`insert into korisnici (ime, prezime, email, lozinka) values ($1, $2, $3, $4) returning id`, [korisnik.ime, korisnik.prezime, korisnik.email, pomocne.kriptuj(korisnik.lozinka)], function (err, result) {
        //done();

        if (err) {
          res.sendStatus(404);
          done();
        } else {
          if (result.rows && result.rows.length > 0 && result.rows[0].id) {
            const id_korisnika = result.rows[0].id;
            client.query(`insert into tip_korisnika (tip, korisnik_id) values ($1, $2)`, [korisnik.uloga, id_korisnika], function (err, result) {
              done();
              if (err) {
                res.sendStatus(500);
              } else {

                next();
              }
            });
          } else {
            res.sendStatus(500);
          }
        }
      });
    });
  },
  //sljedeca
  prikaziKorisnike: function (req, res, next) {
    pool.connect(function (err, client, done) {
      if (err) {
        res.end('{"error" : "Error", "status" : 500}');
      }
      client.query(`select k.id, k.ime, k.prezime, k.email, tk.tip from korisnici as k left join tip_korisnika as tk on tk.korisnik_id = k.id where k.jeLiObrisan = false`, [], function(err, result) {
        done();

        if (err) {
          return res.sendStatus(500);
        }
        else{
          console.info(result.rows);
          req.korisnici = result.rows;
          req.tip_korisnika = result.rows;
          next();
        }
      });
    }) },

   prikaziProjekte: function (req, res, next){
    pool.connect(function (err, client, done) {
      if (err) {
        res.end('{"error" : "Error", "status" : 500}');
      }
      client.query(`select p.id, p.naziv, p.opis, p.startni_datum, p.zavrsni_datum from projekti p`, [], function(err, result) {
        done();

        if (err) {
          return res.sendStatus(500);
        }
        else{
          console.info(result.rows);
          req.projekti = result.rows;

          next();
        }
      });
    })
  },

   dodajProjekat: function (req, res, next) {
    var projekat={
      naziv: req.body.naziv,
      opis: req.body.opis,
      startni_datum: req.body.startni_datum,
      zavrsni_datum: req.body.zavrsni_datum,
      email_menadera: req.body.email
    };

    pool.connect(function (err, client, done) {
      if (err) {
        res.end('{"error" : "Error", "status" : 500}');
      }
      let menader_id;
      client.query(`select k.id from korisnici k where k.email = $1`, [projekat.email_menadera], function (err, result) {
        //done();

        if (err) {
          console.info(err);
          res.sendStatus(404);
          done();
        }
        if (!result.rows || result.rows.length ===0){
          console.error("menader nije pronaden");
          res.sendStatus(404);
          done();
        }

        else {
          menader_id = result.rows[0].id;
          client.query(`insert into projekti (naziv, opis, startni_datum, zavrsni_datum, menader_projekta) values ($1, $2, $3, $4, $5)`, [projekat.naziv, projekat.opis, projekat.startni_datum, projekat.zavrsni_datum, menader_id], function (err, result) {
              done();
              if (err) {
                console.error(err);
                res.sendStatus(500);
              } else {
                next();
              }
            });
          }
      });
    });
  }
}
/* GET users listing. */
router.get('/korisnici', db.prikaziKorisnike, function (req, res, next) {
  //res.send('respond with a resource');
  res.render('korisnici', {title:'Korisnici', korisnici: req.korisnici, tip_korisnika: req.tip_korisnika});
});

router.get('/noviKorisnik', function (req, res, next) {
  res.render('noviKorisnik', {title: 'Dodaj novog korisnika'});
});

router.post('/noviKorisnik', db.registrujKorisnika, function (req, res, next) {
  //res.sendStatus(200);
  res.redirect('/users/korisnici')
});

router.get('/noviProjekat', function (req, res, next) {
  res.render('noviProjekat', {title: 'Dodaj novi projekat'});
});

router.post('/noviProjekat', db.dodajProjekat, function (req, res, next) {
  //res.sendStatus(200);

  res.redirect('/users/sviProjekti')
});

router.get('/adminPocetna', function (req, res, next) {
  //res.send('respond with a resource');
  res.render('adminPocetna', {title:'Admin'});
});


router.get('/obrisi/korisnici/:id', function (req, res, next) {
  var id = req.params.id;

  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status" : 500}');
    }
    client.query(`update korisnici set jeLiObrisan = true where id = '${id}'`, function(err, result) {
      done();

      if (err) {
        return res.sendStatus(500);
      }
      else{

        console.info(result.rows);
        res.redirect('/users/korisnici')
      }
    });
  })
});


router.get('/detalji/:id', function (req, res, next) {
  var id = req.params.id;

  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status" : 500}');
    }
    client.query(`select * from korisnici where id = $1`, [id], function(err, result) {
      done();

      if (err) {
        //return res.sendStatus(500);
        return res.send(err);
      }
      else{
        console.info(result.rows);
       // res.render('korisnici', {title: 'Korisnici', korisnici: result.rows});
        req.korisnici = result.rows;
        next();
      }
    });
  })
},
    function (req, res, next) {
      var id = req.params.id;
      pool.connect(function (err, client, done) {
        if (err) {
          return res.send(err);
        }
        client.query(`select k.id, k.ime, k.prezime, k.email, p.id, p.naziv as projekat_naziv, p.opis as projekat_opis, t.id, t.naziv as task_naziv, t.opis as task_opis, st.status as task_status, sum(broj_radnih_sati) as ukupno_radnih_sati from korisnici k
                    left join dodijeljeni_projekti dp on k.id = dp.korisnik_id
                    left join projekti p on p.id = dp.projekat_id 
                    left join taskovi t on p.id = t.projekat_id 
                    left join status_taska st on t.id = st.task_id
                    left join radni_sati rs on t.id = rs.task_id
                    where k.jeLiObrisan = false and k.id = $1
                    group by k.id, p.id, t.id, st.status
                    order by p.naziv`, [id], function (err, result) {
          done();
          if (err) {
            return res.send(err);
          } else {
            console.info(result.rows);
            //res.render('detaljORadniku', {title: 'Detalji', projekti: result.rows, korisnici: req.korisnici});
            req.projekti = result.rows;
            next();
          }
        });
      });
    },
    function (req, res, next) {
      var id = req.params.id;
      pool.connect(function (err, client, done) {
        if (err) {
          return res.send(err);
        }
        client.query(`select korisnici.ime, korisnici.prezime,
                SUM(CASE WHEN EXTRACT(MONTH FROM datum) = 1 THEN broj_radnih_sati ELSE 0 END) AS januar,
                SUM(CASE WHEN EXTRACT(MONTH FROM datum) = 2 THEN broj_radnih_sati  ELSE 0 END) AS februar,
                SUM(CASE WHEN EXTRACT(MONTH FROM datum) = 3 THEN broj_radnih_sati  ELSE 0 END) AS mart,
                SUM(CASE WHEN EXTRACT(MONTH FROM datum) = 4 THEN broj_radnih_sati  ELSE 0 END) AS april,
                SUM(CASE WHEN EXTRACT(MONTH FROM datum) = 5 THEN broj_radnih_sati  ELSE 0 END) AS maj,
                SUM(CASE WHEN EXTRACT(MONTH FROM datum) = 6 THEN broj_radnih_sati  ELSE 0 END) AS juni,
                SUM(CASE WHEN EXTRACT(MONTH FROM datum) = 7 THEN broj_radnih_sati  ELSE 0 END) AS juli,
                SUM(CASE WHEN EXTRACT(MONTH FROM datum) = 8 THEN broj_radnih_sati  ELSE 0 END) AS avgust,
                SUM(CASE WHEN EXTRACT(MONTH FROM datum) = 9 THEN broj_radnih_sati  ELSE 0 END) AS septembar,
                SUM(CASE WHEN EXTRACT(MONTH FROM datum) = 10 THEN broj_radnih_sati  ELSE 0 END) AS oktobar,
                SUM(CASE WHEN EXTRACT(MONTH FROM datum) = 11 THEN broj_radnih_sati  ELSE 0 END) AS novembar,
                SUM(CASE WHEN EXTRACT(MONTH FROM datum) = 12 THEN broj_radnih_sati  ELSE 0 END) AS decembar,
                SUM(broj_radnih_sati) AS ukupno_radnih_dana
              FROM
                radni_sati
              JOIN
                korisnici ON radni_sati.korisnik_id = korisnici.id
              WHERE
                korisnici.jeLiObrisan = false and korisnici.id = $1 and
                EXTRACT(YEAR FROM datum) = 2024
              GROUP BY
                korisnici.id, korisnici.ime, korisnici.prezime;`, [id], function (err, result) {
          done();
          if (err) {
            return res.send(err);
          } else {
            console.info(result.rows);
            res.render('detaljORadniku', {title: 'Detalji o radniku', radniSati: result.rows, projekti:req.projekti, korisnici: req.korisnici});

          }
        });
      });
    }

    );

// router.get('/sviProjekti', function (req, res, next) {
//
//       pool.connect(function (err, client, done) {
//         if (err) {
//           res.end('{"error" : "Error", "status" : 500}');
//         }
//         client.query(`select p.naziv, p.opis, p.startni_datum, p.zavrsni_datum, k.email as email_menadzera from projekti p join
//                     korisnici k on p.menader_projekta = k.id where p.zavrsni_datum < CURRENT_DATE()`, [], function(err, result) {
//           done();
//
//           if (err) {
//             //return res.sendStatus(500);
//             return res.send(err);
//           }
//           else{
//             console.info(result.rows);
//             req.nezavrseniProjekti = result.rows;
//             next();
//           }
//         });
//       })
//     }
    // function (req, res, next) {
    //   pool.connect(function (err, client, done) {
    //     if (err) {
    //       return res.send(err);
    //     }
    //     client.query(`select p.naziv, p.opis, p.startni_datum, p.zavrsni_datum, k.email as email_menadzera from projekti p join
    //                 korisnici k on p.menader_projekta = k.id where p.zavrsni_datum <CURRENT_DATE()`, [], function (err, result) {
    //       done();
    //       if (err) {
    //         return res.send(err);
    //       } else {
    //         console.info(result.rows);
    //         res.render('sviProjekti', {title: 'Svi projekti',zavrseniProjekti: req.zavrseniProjekti,
    //           nezavrseniProjekti: result.rows});
    //
    //       }
    //     });
    //   });
    // }

  // )

router.get('/sviProjekti',db.prikaziProjekte, function (req, res, next) {
  //res.send('respond with a resource');
  res.render('sviProjekti', {title:'Svi projekti', projekti:req.projekti});
});


router.get('/detaljiProjekta/:id', function (req, res, next) {
      var id = req.params.id;
      pool.connect(function (err, client, done) {
        if (err) {
          res.end('{"error" : "Error", "status" : 500}');
        }
        client.query(`select p.id, p.naziv, p.opis, p.startni_datum, p.zavrsni_datum, p.menader_projekta, k.id, k.ime, k.prezime from projekti p
                    left join korisnici k on k.id = p.menader_projekta 
                    where k.jeLiObrisan = false and p.id = $1`, [id], function(err, result) {
          done();

          if (err) {
            console.info(id);
            return res.sendStatus(500);
          }
          else{
            console.info(id);
            console.info(result.rows);
            req.detalji = result.rows;
            next();
            // res.render('detaljiProjekta', {title: 'Detalji o projektu', detalji:result.rows});
          }
        });
      })
    },
    function (req, res, next) {

      var id = req.params.id;
      pool.connect(function (err, client, done) {
        if (err) {
          res.end('{"error" : "Error", "status" : 500}');
        }
        client.query(`select k.id, k.ime, k.prezime, k.email, coalesce(sum(rs.broj_radnih_sati), 0) as ukupan_broj_sati from korisnici k
                          left join dodijeljeni_projekti dp on k.id = dp.korisnik_id
                          left join radni_sati rs on k.id = rs.korisnik_id
                          where k.jeLiObrisan = false
                          and dp.projekat_id = $1
                          group by k.id, k.ime, k.prezime, k.email;`, [id], function(err, result) {
          done();
          // and rs.task_id in (select id from taskovi where projekat_id = $1)

          if (err) {
            return res.sendStatus(500);
          }
          else{
            console.info(result.rows);
            req.radnici = result.rows;
            next();
            // res.render('detaljiProjekta', {title: 'Detalji o projektu', radnici:result.rows, detalji: req.detalji});
          }
        });
      })
    },
    function (req, res, next) {

      var id = req.params.id;
      pool.connect(function (err, client, done) {
        if (err) {
          res.end('{"error" : "Error", "status" : 500}');
        }
        client.query(`select k.ime, k.prezime, t.korisnik_id, t.naziv, t.opis, st.status, coalesce(sum(rs.broj_radnih_sati), 0) as ukupan_broj_sati from taskovi t
                          left join radni_sati rs on t.id = rs.task_id
                          left join status_taska st on st.task_id = t.id
                          left join korisnici k on k.id = t.korisnik_id
                          where t.projekat_id = $1
                          group by k.ime, k.prezime, t.id, t.naziv, t.opis, st.status`, [id], function(err, result) {
          done();

          if (err) {
            console.error("Greška u upitu:", err.message);
            return res.sendStatus(404);
          }
          else{
            console.info(result.rows);
            res.render('detaljiProjektaRadnik', {title: 'Detalji o projektu', taskovi:result.rows, detalji: req.detalji, radnici: req.radnici});
          }
        });
      })
    }

);

router.get('/obradiStatus/:id/:projekat_id', function(req, res) {
  var task_id = req.params.id;
  var projekat_id = req.params.projekat_id;
  pool.connect(function (err, client, done) {
    if (err) {
      return res.status(500);
    }

    client.query(`update status_taska set status = \'obrađen\' where task_id = '${task_id}'`, function(err, result) {
      done();

      if (err) {
        return res.sendStatus(500);
      }

      console.info(result.rows);
      res.redirect("/users/detaljiProjekta/" + projekat_id);
    });
  });
});

// UREDI KORISNIKA

router.get('/uredi/:id', function (req,res,next){
    var id = req.params.id;


    pool.connect(function (err, client, done) {
      if (err) {
        res.end('{"error" : "Error", "status" : 500}');
      }
      client.query('select k.*, tk.tip from korisnici k left join tip_korisnika tk on tk.korisnik_id = k.id where k.id=$1', [id], function (err, result) {
        done();
        if (err) {
          console.info(err);
          res.sendStatus(500);
        } else {
          res.render('urediKorisnika', {title:'Izmijeni podatke o korisniku',korisnik: result.rows});
        }
      });
    });
});

router.post('/uredi', function (req,res,next){
  var korisnik = {
    ime: req.body.ime,
    prezime: req.body.prezime,
    email: req.body.email,
    lozinka: req.body.lozinka,
    uloga: req.body.uloga
  };
  var korisnik_id;
  pool.connect(function (err,client,done) {
    if(err){
      res.end('{"error" : "Error", "status" : 500}');
    }
    client.query(`select k.id from korisnici k where k.email = $1`, [korisnik.email], function (err, result) {

      if (err) {
        console.info(err);
        res.sendStatus(404);
        done();
      }
      if (!result.rows || result.rows.length ===0){
        console.error("korisnik nije pronaden");
        res.sendStatus(404);
        done();
      }

      else {
        korisnik_id = result.rows[0].id;
        client.query(`update korisnici set ime = $2, prezime = $3, email = $4, lozinka = $5 where id=$1`, [korisnik_id, korisnik.ime, korisnik.prezime,
                      korisnik.email, pomocne.kriptuj(korisnik.lozinka)], function (err, result) {

          if (err) {
            console.error(err);
            res.sendStatus(500);
            done();
          } else {
              client.query(`update tip_korisnika set tip = $1 where korisnik_id = $2`, [korisnik.uloga, korisnik_id], function (err, result) {
                if (err) {
                  res.sendStatus(500);
                  done();

                } else {
                  res.redirect('/users/korisnici');
                }
              });
            }
        });
      }
    });
  });
});

//UREDI PROJEKAT

router.get('/urediProjekat/:id', function (req,res,next){
  var id = req.params.id;


  pool.connect(function (err, client, done) {
    if (err) {
      res.end('{"error" : "Error", "status" : 500}');
    }
    client.query('select * from projekti where id=$1', [id], function (err, result) {
      done();
      if (err) {
        console.info(err);
        res.sendStatus(500);
      } else {
        res.render('urediProjekat', { title:'Izmijeni podatke o projektu', projekat: result.rows});
      }
    });
  });
});

router.post('/urediProjekat', function (req,res,next){
  var projekat = {
    id: req.body.id,
    naziv: req.body.naziv,
    opis: req.body.opis,
    startni_datum: req.body.startni_datum,
    zavrsni_datum: req.body.zavrsni_datum
  };

  pool.connect(function (err,client,done) {
    if(err){
      res.end('{"error" : "Error", "status" : 500}');
    }
      else {
        client.query(`update projekti set naziv = $2, opis = $3, startni_datum = $4, zavrsni_datum = $5 where id=$1`, [projekat.id, projekat.naziv, projekat.opis,
          projekat.startni_datum, projekat.zavrsni_datum], function (err, result) {

          if (err) {
            console.error(err);
            res.sendStatus(500);
            done();
          } else res.redirect('/users/sviProjekti');
        });
      }
    });
});

router.get('/mojProfil', function (req, res, next) {
      var id = req.cookies.opkn.id;

      pool.connect(function (err, client, done) {
        if (err) {
          res.end('{"error" : "Error", "status" : 500}');
        }
        client.query(`select * from korisnici k where k.id = $1 and k.jeLiObrisan=false`, [id], function(err, result) {
          done();

          if (err) {
            //return res.sendStatus(500);
            return res.send(err);
          }
          else{
            console.info(result.rows);
            res.render('adminProfil', {title: 'Moj profil', korisnici: result.rows});
          }
        });
      })
    },

);


//res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');




module.exports = router;
