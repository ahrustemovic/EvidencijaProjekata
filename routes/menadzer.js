var express = require('express');
var router = express.Router();
/* dodatno */
var pg = require('pg');
var bcrypt = require('bcrypt');
const {resolveInclude} = require("ejs");
const nodemailer = require("nodemailer");
const fs = require('fs');

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

let db = {
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
                        where p.menader_projekta = $1`, [id], function (err, result) {
                done();
                if (err) {
                    return res.send(err);
                } else {
                    req.projekti = result.rows;
                    next();
                    //console.info(result.rows);
                    //res.render('mojProfil', {title: 'Moj profil', projekti: result.rows, korisnici: req.korisnici});

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
            client.query(`select p.naziv, p.opis , p.startni_datum, p.zavrsni_datum from projekti p 
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
            client.query(`select t.id, t.naziv from timovi t
                        where t.menader_tima = $1`, [id], function (err, result) {
                done();
                if (err) {
                    return res.send(err);
                } else {
                    console.info(result.rows);
                    res.render('mojProfil', {title: 'Moj profil', timovi: result.rows, moji_projekti: req.moji_projekti, korisnici: req.korisnici, projekti: req.projekti});

                }
            });
        });
    }
);

router.get('/tim/:id', function (req, res, next) {
    var id = req.params.id;
    pool.connect(function (err, client, done) {
        if (err) {
            res.end('{"error" : "Error", "status" : 500}');
        }
        client.query(`select t.id, t.naziv from timovi as t where t.id = '${id}'`, function(err, result) {
            done();

            if (err) {
                return res.sendStatus(500);
            }
            else{
                console.info(result.rows);
                req.nazivTima = result.rows;
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
            client.query(`select k.id, k.ime, k.prezime from korisnici as k left join timovi_radnici as tr on tr.korisnik_id = k.id where k.jeLiObrisan = false and tr.tim_id = $1`, [id], function(err, result) {
                done();

                if (err) {
                    return res.sendStatus(404);
                }
                else{
                    console.info(result.rows);
                    res.render('radniciUTimu', {title: 'Radnici', radnici: result.rows, nazivTima: req.nazivTima});
                }
            });
        })
    }

    );

router.get('/noviProjekat/:id', function (req, res, next) {
     const id = req.params.id;
     res.render('noviProjekatMenadzer', {title: 'Kreiraj novi projekat'});
});

router.post('/noviProjekat', db.dodajProjekat, function (req, res, next) {
     const id = req.cookies.opkn.id;
     res.redirect(`/menadzer/mojProfil/${id}`);
    //res.redirect('back');
});


router.get('/detaljiRadnika/:id', function (req, res, next) {
    var id = req.params.id;
    pool.connect(function (err, client, done) {
        if (err) {
            res.end('{"error" : "Error", "status" : 500}');
        }
        client.query(`select k.id, k.ime, k.prezime, k.email, p.id, p.naziv as projekat_naziv, t.id, t.naziv as task_naziv, t.opis as task_opis, st.status as task_status, sum(broj_radnih_sati) as ukupno_radnih_sati from korisnici k
                    left join dodijeljeni_projekti dp on k.id = dp.korisnik_id
                    left join projekti p on p.id = dp.projekat_id 
                    left join taskovi t on p.id = t.projekat_id 
                    left join status_taska st on t.id = st.task_id
                    left join radni_sati rs on t.id = rs.task_id
                    where k.jeLiObrisan = false and k.id = $1
                    group by k.id, p.id, t.id, st.status
                    order by p.naziv`, [id], function(err, result) {
            done();

            if (err) {
                return res.sendStatus(500);
            }
            else{
                console.info(result.rows);
                req.detalji = result.rows;
                next();
                // res.render('detaljiRadnika', {title: 'Detalji o radniku', detalji:result.rows});
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
                    res.render('detaljiRadnika', {title: 'Detalji o radniku', radniSati: result.rows, detalji:req.detalji});

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
        client.query(`select p.id as id_projekta, p.naziv, p.opis, p.startni_datum, p.zavrsni_datum, p.menader_projekta, k.id, k.ime, k.prezime from projekti p
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
            client.query(`select distinct k.id, k.ime, k.prezime, k.email, coalesce(sum(rs.broj_radnih_sati), 0) as ukupan_broj_sati from korisnici k
                          left join dodijeljeni_projekti dp on k.id = dp.korisnik_id
                          left join radni_sati rs on k.id = rs.korisnik_id
                          where k.jeLiObrisan = false
                          and dp.projekat_id = $1
                          group by k.id, k.ime, k.prezime, k.email;`, [id], function(err, result) {
                done();

                // and rs.task_id in (select id from taskovi where projekat_id = $1)

                if (err) {
                    console.error(err);
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
                    res.render('detaljiProjekta', {title: 'Detalji o projektu', taskovi:result.rows, detalji: req.detalji, radnici: req.radnici});
                }
            });
        })
    }

    );





// ovo za radnika u projekat
router.get('/dodajRadnikaUProjekat/:id', function (req, res, next) {
    res.render('dodajRadnikaUProjekat', {title: 'Novi radnik'});
});

router.post('/dodajRadnikaUProjekat/', function (req, res, next) {
    //var id = req.params.id
    var izForme = {
        naziv: req.body.naziv,
        email: req.body.email
    };

    pool.connect(function (err, client, done) {
        if (err) {
            res.end('{"error" : "Error", "status" : 500}');
        }
        let radnik_id;
        let projekat_id;
        client.query(`select k.id from korisnici k where k.email = $1`, [izForme.email], function (err, result) {

            if (err) {
                console.info(err);
                res.sendStatus(404);
                done();
            }
            if (!result.rows || result.rows.length === 0) {
                console.error("radnik nije pronaden");
                res.sendStatus(404);
                done();
            } else {
                radnik_id = result.rows[0].id;
                client.query(`select * from projekti p where p. naziv = $1`, [izForme.naziv], function (err, result) {
                    if (err) {
                        console.error(err);
                        res.sendStatus(500);
                        done();

                    }
                    if (!result.rows || result.rows.length === 0) {
                        console.error("projekat nije pronaden");
                        res.sendStatus(404);
                        done();
                    } else {
                        projekat_id = result.rows[0].id;
                        console.log(projekat_id);
                        client.query(`insert into dodijeljeni_projekti(korisnik_id, projekat_id) values ($1, $2)`, [radnik_id, projekat_id], function (err, result) {
                            done();
                            if (err) {
                                console.error(err);
                                res.sendStatus(500);
                            } else {
                                res.redirect(`/menadzer/detaljiProjekta/${projekat_id}`)
                            }
                        });
                    }
                });
            }
        });
    })
})


router.get('/noviTim/:id', function (req, res, next) {
    res.render('noviTim', {title: 'Novi tim'});
});

router.post('/noviTim', function (req, res, next) {
    var izForme = {
        naziv: req.body.naziv,
        email: req.body.email
    };

    pool.connect(function (err, client, done) {
        if (err) {
            res.end('{"error" : "Error", "status" : 500}');
        }
        let menadzer_id;
        client.query(`select k.id from korisnici k where k.email = $1`, [izForme.email], function (err, result) {

            if (err) {
                console.info(err);
                res.sendStatus(404);
                done();
            }
            if (!result.rows || result.rows.length === 0) {
                console.error("menadzer nije pronaden");
                res.sendStatus(404);
                done();
            } else {
                menadzer_id = result.rows[0].id;
                client.query(`insert into timovi(naziv, menader_tima) values ($1, $2)`, [izForme.naziv, menadzer_id], function (err, result) {
                    done();
                    if (err) {
                        console.error(err);
                        res.sendStatus(500);
                    } else {
                        res.redirect(`/menadzer/mojProfil/${menadzer_id}`)
                    }
                        });
                    }
                });
    })
})

router.get('/dodajRadnikaUTim/:id', function (req, res, next) {
    res.render('dodajRadnikaUTim', {title: 'Radni sati', id: req.params.id});
});

router.post('/dodajRadnikaUTim/:id', function (req, res, next) {
    var id = req.params.id;
    var dodajKod = {
        email: req.body.email
    };


    pool.connect(function (err, client, done) {
        if (err) {
            console.error(err);
            res.end('{"error" : "Error", "status" : 500}');
        }
        let korisnik_id;
        client.query(`select k.id from korisnici k where k.email = $1`, [dodajKod.email], function (err, result) {
            //done();

            if (err) {
                console.info(err);
                res.sendStatus(500);
                done();
            }
            if (!result.rows || result.rows.length ===0){
                console.error("id nije pronaden");
                res.sendStatus(500);
                done();
            }

            else {
                korisnik_id = result.rows[0].id;
                client.query(`insert into timovi_radnici (tim_id, korisnik_id) values ($1, $2)`, [id, korisnik_id], function (err, result) {
                    done();
                    if (err) {
                        console.error(err);
                        res.sendStatus(500);
                    } else {
                        res.redirect('/tim/' + id)

                    }
                });
            }
        });
    });

});

router.get('/dodajTask/:id_projekta', function (req, res, next) {
    res.render('dodajTask', {title: 'Novi task', id_projekta: req.params.id_projekta});
});

router.post('/dodajTask/:id_projekta', function (req, res, next) {
    var id_projekta = req.params.id_projekta
    var izForme = {
        naziv: req.body.naziv,
        opis: req.body.opis,
        email: req.body.email,
    };

    pool.connect(function (err, client, done) {
        if (err) {
            res.end('{"error" : "Error", "status" : 500}');
        }
        let radnik_id;
        let task_id;

        client.query(`select k.id from korisnici k where k.email = $1`, [izForme.email], function (err, result) {

            if (err) {
                console.info(err);
                res.sendStatus(404);
                done();
            }
            if (!result.rows || result.rows.length === 0) {
                console.error("radnik nije pronaden");
                res.sendStatus(404);
                done();
            } else {
                radnik_id = result.rows[0].id;
                client.query(`insert into taskovi(naziv, opis, projekat_id, korisnik_id) values ($1, $2, $3, $4) returning id`, [izForme.naziv, izForme.opis, id_projekta, radnik_id], function (err, result) {
                    if (err) {
                        console.error(err);
                        res.sendStatus(500);
                        done();
                    } else {
                        task_id = result.rows[0].id;

                        client.query(`insert into status_taska(status, task_id) values ($1, $2)`, ['u obradi', task_id], function (err, result) {
                            done();
                            if (err) {
                                console.error(err);
                                res.sendStatus(500);
                            } else {
                                res.redirect(`/menadzer/detaljiProjekta/${id_projekta}`);
                            }
                        });
                    }
                });
            }
        });
    })
});


router.get('/izvjestaj/:id', function (req, res, next){
    var id = req.cookies.opkn.id;
    pool.connect(function (err, client, done) {
        if (err) {
            res.end('{"error" : "Error", "status" : 500}');
        }

        client.query(`select p.id, p.naziv, k.ime, k.prezime, COALESCE(SUM(rs.broj_radnih_sati), 0) AS ukupno_radnih_sati from projekti p
                      join dodijeljeni_projekti dp on dp.projekat_id = p.id
                      join korisnici k on k.id = dp.korisnik_id
                      left join radni_sati rs on rs.korisnik_id = k.id
                      where p.menader_projekta = $1 
                      group by p.naziv, k.ime, k.prezime, p.id` , [id], function (err, result) {
                done()
            if (err) {
                console.info(err);
                res.sendStatus(404);
            }
             else {
                res.render('izvjestaj', {title: 'Izvjestaj', radniSati: result.rows});
            }
            });
    })
});

router.post('/posaljiNaMail', function (req, res, next) {
    try {
        // Pročitaj HTML sadržaj iz tijela zahtjeva
        const htmlContent = req.body.htmlContent;

        // Provjeri postojanje HTML sadržaja
        if (!htmlContent || htmlContent.trim() === '') {
            return res.status(400).send('Nedostaje HTML sadržaj.');
        }

        // Dinamičko postavljanje primatelja e-maila
        const toEmail = req.cookies.opkn.email;

        nodemailer.createTestAccount((err, account) => {
            if (err) {
                console.error('Failed to create a testing account. Check your nodemailer configuration.');
                return res.status(500).send('Greška prilikom slanja e-maila.');
            }

            // Stvaranje transporter-a s testnim računom
            const transporter = nodemailer.createTransport({
                host: account.smtp.host,
                port: account.smtp.port,
                secure: account.smtp.secure,
                auth: {
                    user: account.user,
                    pass: account.pass,
                },
            });

            // Postavljanje opcija e-maila
            const mailOptions = {
                from: 'anesa.node@gmail.com',
                to: toEmail,
                subject: 'Izvjestaj!',
                html: htmlContent,
            };

            // Slanje e-maila s definiranim transporter objektom
            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error(error);
                    return res.status(500).send('Greška prilikom slanja e-maila.');
                }

                // Prikazivanje URL-a za pregled e-maila (za testiranje)
                console.log('Preview URL: ' + nodemailer.getTestMessageUrl(info));

                // Vraćanje odgovora klijentu
                res.status(200).send('Izvještaj poslan na e-mail!');
            });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).send('Greška prilikom slanja e-maila.');
    }
});



module.exports = router;