process.env["NTBA_FIX_319"] = "1";
import Telegraf, {
  Buttons,
  ContextMessageUpdate as BadMessage
} from "telegraf";
import Extra from "telegraf/extra";
import Markup from "telegraf/markup";
import Stage from "telegraf/stage";
import session from "telegraf/session";
import Scene from "telegraf/scenes/base";
import * as _ from "lodash";
import { Pool, Client } from "pg";
const TOKEN: string = process.env.TELEGRAM_BOT_TOKEN_TICKETS;
const PORT = parseInt(process.env.PORT) || 443;
const HOST_URL: string = "https://knu-ticket-bot.herokuapp.com";

interface DBUser {
  tg_id: string | undefined;
  fio: string | undefined;
  faculty: string | undefined;
  group_num: string | undefined;
  stud_id: string | undefined;
}

interface ContextMessageUpdate extends BadMessage {
  scene: any;
}

type fields = "tg_id" | "fio" | "faculty" | "group_num" | "stud_id";

const stage = new Stage();

const getName = new Scene("getName");
stage.register(getName);
const getFac = new Scene("getFac");
stage.register(getFac);
const getGroup = new Scene("getGroup");
stage.register(getGroup);
const getStudId = new Scene("getStudId");
stage.register(getStudId);
const menu = new Scene("menu");
stage.register(menu);

const users: Set<DBUser> = new Set();

const db = {
  connectionString: process.env.DATABASE_URL,
  ssl: true
};

const start_btns: Buttons[][] = [
  [{ text: "Заказать проездной" }, { text: "Изменить свои данные" }]
];

const bot = new Telegraf(TOKEN);

bot.use(session());
bot.use(stage.middleware());

const pool = new Pool(db);

bot.start((ctx: ContextMessageUpdate) => {
  if (ctx.from.id == ctx.chat.id) {
    pool.connect().then(client =>
      client
        .query(`SELECT * FROM students WHERE tgid='${ctx.from.id}'`)
        .then(res => {
          client.release();
          if (res.rowCount != 0) {
            ctx.reply(
              `Здравствуй, ${res.rows[0].name}`,
              Markup.keyboard(start_btns)
            );
            ctx.scene.enter("menu");
          } else {
            ctx.reply(
              `Здравствуй, новый пользователь!
              Для работы мне нужны некоторые твои данные.Сначала введи свои имя и фармилию:`
            );
            ctx.scene.enter("getName");
            users.add({
              tg_id: String(ctx.from.id),
              fio: undefined,
              faculty: undefined,
              group_num: undefined,
              stud_id: undefined
            });
          }
        })
        .catch(e => {
          client.release();
          console.log(e.stack);
        })
    );
  }
});

// getName.command("start", async (ctx: ContextMessageUpdate) => {
//   ctx.reply("Начнем заново. Введите имя и фамилию");
//   setField(ctx.from.id, "fio", undefined);
//   await ctx.scene.leave("getEduc");
//   ctx.scene.enter("getName");
// });

// фио
getName.hears(
  /([А-Я][а-я]+ [А-Я][а-я]+)/,
  async (ctx: ContextMessageUpdate) => {
    setField(ctx.from.id, "fio", ctx.match[1]);
    ctx.reply(
      "Хорошо, а теперь официальное название факультета, на котором ты учишься:"
    );
    await ctx.scene.leave("getName");
    ctx.scene.enter("getFac");
  }
);
getName.on("text", async (ctx: ContextMessageUpdate) => {
  ctx.reply("Введите свои имя и фамилию");
});
// факультет
getFac.hears(/([A-Za-z ]+)/, async (ctx: ContextMessageUpdate) => {
  setField(ctx.from.id, "faculty", ctx.match[1]);
  ctx.reply("Название группы:");
  await ctx.scene.leave("getFac");
  ctx.scene.enter("getGroup");
});
getFac.on("text", async (ctx: ContextMessageUpdate) => {
  ctx.reply("Введите название своего факультета");
});
// группа
getGroup.hears(/([А-Я]-\d\d)/, async (ctx: ContextMessageUpdate) => {
  setField(ctx.from.id, "group_num", ctx.match[1]);
  ctx.reply(
    "А теперь самое главное: номер твоего студенческого билета, чтобы убедиться что ты не фейк:"
  );
  await ctx.scene.leave("getGroup");
  ctx.scene.enter("getStudId");
});
// студак
getStudId.hears(/(\d+)/, (ctx: ContextMessageUpdate) => {
  const thisUser = [...users].filter(
    user => parseInt(user.tg_id) == ctx.from.id
  )[0];
  console.log(thisUser);
  pool.connect().then(client =>
    client
      .query(reg(thisUser))
      .then(res => {
        client.release();
        users.delete(thisUser);
        ctx.reply(
          "Вы были успешно зарегистрированы!",
          Extra.keyboard(start_btns)
        );
      })
      .catch(e => {
        client.release();
        console.log("error while inserting new user");
        ctx.reply("Произошла ошибка регистрации, попробуйте позже");
        console.log(e.stack);
        users.delete(thisUser);
      })
  );
});

bot.hears(/^\/sql (.+)$/, (ctx: ContextMessageUpdate) => {
  if (ctx.from.id == 468074317) {
    pool.connect().then(client =>
      client
        .query(ctx.match[1])
        .then(res => {
          client.release();
          const resp = JSON.stringify(res.rows)
            .replace(/\\n|,|}/g, "\n")
            .replace(/{|\[|\]|"/g, "");
          ctx.reply(resp || "Выполнено!");
        })
        .catch(e => {
          client.release();
          console.log(e.stack);
        })
    );
  }
});

// bot.on("callback_query", ctx => {
//   console.log("cb works");
//   const { data } = ctx;
//   switch (data) {
//     case "reg":
//       // ctx.reply(ctx.from.id, "Ваши имя и фамилия:");
//       // users.add({
//       //   tg_id: ctx.from.id,
//       //   fio: undefined,
//       //   faculty: undefined,
//       //   group_num: undefined,
//       //   stud_id: undefined
//       // });
//       //"Введите информацию о себе в формате:\nИмя и фамилия: *Ваши имя и фамилия*\nФакультет: *Ваш факультет*\nКурс: *Ваш курс*\nГруппа: *Ваша группа*\nНомер студенческого билета: *Ваш номер студенческого билета*"
//       break;
//     case "buy_ticket":
//       break;
//     case "change_data":
//       break;
//     default:
//       console.log(data);
//       break;
//   }
// });

bot.launch({
  webhook: {
    domain: HOST_URL,
    port: PORT
  }
});

const reg = (user: DBUser) =>
  `INSERT INTO students VALUES ("${user.stud_id}", "${user.tg_id}", "${user.fio}", "${user.faculty}", "${user.group_num}")`;

const setField = (from_id: number, field: fields, val: string): void => {
  _.each([...users], (user: DBUser) => {
    if (parseInt(user.tg_id) == from_id) user[field] = val;
  });
  // users.forEach(user => {
  //   if (parseInt(user.tg_id) == from_id) user[field] = val;
  // });
};

{
  const tables_init: string =
    "CREATE TABLE IF NOT EXISTS students (" +
    "studid INT UNIQUE," +
    "tgid INT UNIQUE," +
    "name_surname TEXT ," +
    "faculty TEXT ," +
    "group_num TEXT ," +
    "PRIMARY KEY ( studid ));" +
    "\n" +
    "CREATE TABLE IF NOT EXISTS proforgs (" +
    "studid INT UNIQUE," +
    "tgid INT UNIQUE," +
    "name_surname TEXT ," +
    "group_num TEXT ," +
    "PRIMARY KEY ( studid ));";
  pool.connect().then(client =>
    client
      .query(tables_init)
      .then(res => {
        client.release();
        console.log("table was succesfully inited");
      })
      .catch(e => {
        client.release();
        console.log("error by trying to init table");
        console.log(e.stack);
      })
  );
}
