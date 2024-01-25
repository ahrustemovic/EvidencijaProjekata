var express = require('express');
var router = express.Router();
/* dodatno */
var pg = require('pg');
var bcrypt = require('bcrypt');
const {resolveInclude} = require("ejs");

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
                    req.korisnici = result.rows;
                    next();
                }
            });
        })
    },

    function (req, res, next) {
        var id = req.cookies.opkn.id;
        pool.connect(function (err, client, done) {
            if (err) {
                return res.send(err);
            }
            client.query(`select p.id, p.naziv, p.opis , p.startni_datum, p.zavrsni_datum from projekti p 
                        left join dodijeljeni_projekti dp on dp.projekat_id = p.id where dp.korisnik_id = $1 and p.menader_projekta != $1`, [id], function (err, result) {
                done();
                if (err) {
                    return res.send(err);
                } else {
                    req.moji_projekti = result.rows;
                    next();
                }
            });
        });
    },
    function (req, res, next) {
        var id = req.cookies.opkn.id;
        pool.connect(function (err, client, done) {
            if (err) {
                return res.send(err);
            }
            client.query(`select distinct t.id, k.id, k.ime, k.prezime, t.naziv, tr.korisnik_id from korisnici k
                        left join timovi t on k.id = t.menader_tima
                        left join timovi_radnici tr on t.id = tr.tim_id
                        where tr.korisnik_id = $1`, [id], function (err, result) {
                done();
                if (err) {
                    return res.send(err);
                } else {
                    console.info(result.rows);
                    res.render('mojProfilR', {title: 'Moj profil', timovi: result.rows, moji_projekti: req.moji_projekti, korisnici: req.korisnici});

                }
            });
        });
    }
);



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
                // and dp.projekat_id = $1 and rs.task_id IN (SELECT id FROM taskovi WHERE projekat_id = $1)

                if (err) {
                    return res.sendStatus(500);
                }
                else{
                    console.info(result.rows);
                    req.radnici = result.rows;
                    next();
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
            client.query(`select k.ime, k.prezime, t.id, t.korisnik_id, t.naziv, t.opis, t.projekat_id, st.status, coalesce(sum(rs.broj_radnih_sati), 0) as ukupan_broj_sati from taskovi t
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
                    res.render('detaljiProjektaRadnik', {title: 'Detalji o projektu', taskovi:result.rows, detalji: req.detalji, radnici: req.radnici, moj_tip: req.cookies.opkn.tip});
                }
            });
        })
    }

);

function currentDate() {
    const now = new Date();
    return now.toISOString();
}

router.get('/dodajRadneSate/:id', function (req, res, next) {
    res.render('unesiRadneSate', {title: 'Radni sati', id: req.params.id});
});

router.post('/dodajRadneSate', function (req, res, next) {
    var id = req.cookies.opkn.id;
    var dodajKod = {
        kod: req.body.kod
    };
    var podaci = dodajKod.kod.split('#');

    var naziv_projekta = podaci[1];
    var naziv_taska = podaci[2];
    var radni_sati = podaci[3];

    console.log("Naziv projekta:", naziv_projekta);
    console.log("Naziv taska:", naziv_taska);
    console.log("Radni sati:", radni_sati);

    pool.connect(function (err, client, done) {
        if (err) {
            console.error(err);
            res.end('{"error" : "Error", "status" : 500}');
        }
        let task_id;
        client.query(`select t.id from taskovi t left join projekti p on p.id = t.projekat_id where p.naziv = $1 and t.naziv = $2`, [naziv_projekta, naziv_taska], function (err, result) {

            if (err) {
                console.info(err);
                res.sendStatus(404);
                done();
            }
            if (!result.rows || result.rows.length ===0){
                console.error("id nije pronaden");
                res.sendStatus(404);
                done();
            }

            else {
                task_id = result.rows[0].id;
                client.query(`insert into radni_sati (korisnik_id, task_id, broj_radnih_sati, datum) values ($1, $2, $3, $4)`, [id, task_id, radni_sati, currentDate()], function (err, result) {
                    done();
                    if (err) {
                        console.error(err);
                        res.sendStatus(500);
                    } else {
                        res.redirect('/radnik/mojProfil')

                    }
                });
            }
        });
    });

});


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
            res.redirect("/radnik/detaljiProjekta/" + projekat_id);
        });
    });
});

router.get('/chat', function(req, res, next) {
        var id = req.cookies.opkn.id;

        pool.connect(function (err, client, done) {
            if (err) {
                res.end('{"error" : "Error", "status" : 500}');
            }
            client.query(`select * from korisnici k where k.jeLiObrisan = false and k.id != '${id}'`, function(err, result) {
                done();

                if (err) {
                    return res.sendStatus(500);
                }
                else{
                    console.info(result.rows);
                    // req.korisnici = result.rows;
                    // next();
                    res.render('chat', {title: 'Odaberi korisnika', korisnici: result.rows});

                }
            });
        })
    }
);

router.get('/chatPoruke/:id', function(req, res, next) {
        var id = req.cookies.opkn.id;
        var posiljalac_id = req.params.id;

        pool.connect(function (err, client, done) {
            if (err) {
                res.end('{"error" : "Error", "status" : 500}');
            }
            client.query(`select * from poruke p left join korisnici k on k.id = p.posiljalac_id where k.jeLiObrisan = false
                            and ((p.posiljalac_id = $1 and p.primaoc_id = $2) or (p.posiljalac_id = $2 and p.primaoc_id = $1)) order by p.vrijeme desc`, [posiljalac_id, id], function(err, result) {
                done();

                if (err) {
                    return res.sendStatus(500);
                }
                else{
                    console.info(result.rows);
                     req.poruke = result.rows;
                     next();
                    //res.render('chatPoruke', {title: 'Chat', poruke: result.rows, id: id});
                }
            });
        })
    },
    function(req, res, next) {
        var id = req.cookies.opkn.id;
        var posiljalac_id = req.params.id;

        pool.connect(function (err, client, done) {
            if (err) {
                res.end('{"error" : "Error", "status" : 500}');
            }
            client.query(`select k.id, k.ime, k.prezime from korisnici k where k.jeLiObrisan = false
                        and k.id = $1`, [posiljalac_id], function(err, result) {
                done();

                if (err) {
                    return res.sendStatus(500);
                }
                else{
                    console.info(result.rows);
                    // req.korisnici = result.rows;
                    // next();
                    res.render('chatPoruke', {title: 'Chat', id: id, korisnik: result.rows, poruke: req.poruke});
                }
            });
        })
    }

);

function currentDate() {
    const now = new Date();
    return now.toISOString();
}

router.get('/chatPrimiPoruku/:primaPoruku', function (req, res, next) {
    var id = req.cookies.opkn.id;
    var primaPoruku = req.params.primaPoruku;
    const messageText = req.query.message;


    pool.connect(function (err, client, done) {
        if (err) {
            console.error(err);
            res.end('{"error" : "Error", "status" : 500}');
        }
        client.query(`insert into poruke (posiljalac_id, tekst_poruke, vrijeme, primaoc_id) values ($1, $2, $3, $4)`, [id, messageText, currentDate(), primaPoruku], function (err, result) {
            done();
            if (err) {
                console.info(err);
                res.sendStatus(500);
            }

            else {
                res.redirect('/radnik/chatPorukeNovi/' + primaPoruku);
            }
        });
    });

});


router.get('/chatPorukeNovi/:id', function(req, res, next) {
        var id = req.cookies.opkn.id;
        var posiljalac_id = req.params.id;

        pool.connect(function (err, client, done) {
            if (err) {
                res.end('{"error" : "Error", "status" : 500}');
            }
            client.query(`select * from poruke p left join korisnici k on k.id = p.posiljalac_id where k.jeLiObrisan = false
                            and ((p.posiljalac_id = $1 and p.primaoc_id = $2) or (p.posiljalac_id = $2 and p.primaoc_id = $1)) order by p.vrijeme desc`, [posiljalac_id, id], function(err, result) {
                done();

                if (err) {
                    return res.sendStatus(500);
                }
                else{
                    console.info(result.rows);
                    req.poruke = result.rows;
                    next();
                    //res.render('chatPoruke', {title: 'Chat', poruke: result.rows, id: id});
                }
            });
        })
    },
    function(req, res, next) {
        var id = req.cookies.opkn.id;
        var posiljalac_id = req.params.id;

        pool.connect(function (err, client, done) {
            if (err) {
                res.end('{"error" : "Error", "status" : 500}');
            }
            client.query(`select k.id, k.ime, k.prezime from korisnici k where k.jeLiObrisan = false
                        and k.id = $1`, [posiljalac_id], function(err, result) {
                done();

                if (err) {
                    return res.sendStatus(500);
                }
                else{
                    console.info(result.rows);
                    // req.korisnici = result.rows;
                    // next();
                    res.render('chatPoruke2', {title: 'Chat', id: id, korisnik: result.rows, poruke: req.poruke});
                }
            });
        })
    }

);

module.exports = router;