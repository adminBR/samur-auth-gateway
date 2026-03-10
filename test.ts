export const open_Os_TI = async (req: Request, res: Response) => {
  try {
    let user = req.user;
    let classif: string = req.body.ClassSel;
    let situacao: string = req.body.ParadSel;
    let prioridade: string = req.body.PrioSel;
    let dano: string = req.body.dsdano;
    let descricao: string = req.body.dsDescrib;
    let localicazao: number = req.body.dsLocalizacao;
    let equipamento: number = req.body.dsEquipamento;

    const [OS] = await class_tb.findAll({
      attributes: [[Sequelize.literal("MAX(NR_SEQUENCIA)"), "NR_SEQUENCIA"]],
    });
    const cod = await class_tb.findOne({
      attributes: [
        [
          Sequelize.literal(Obter_Cod_PF_Usuario("${user}")),
          "CD_PESSOA_SOLICITANTE",
        ],
      ],
    });
    let seq = OS.NR_SEQUENCIA + 1;
    let cod_user = cod?.CD_PESSOA_SOLICITANTE as string;
    const new_osTI = await class_tb.sequelize?.query(
      "INSERT INTO MAN_ORDEM_SERVICO (NR_SEQUENCIA, NR_SEQ_LOCALIZACAO, NR_SEQ_EQUIPAMENTO, CD_PESSOA_SOLICITANTE, DT_ORDEM_SERVICO, IE_PRIORIDADE, IE_PARADO, DS_DANO_BREVE, DT_ATUALIZACAO, NM_USUARIO, DT_INICIO_DESEJADO, DT_CONCLUSAO_DESEJADA, DS_DANO, IE_TIPO_ORDEM, IE_STATUS_ORDEM, NR_GRUPO_PLANEJ, NR_GRUPO_TRABALHO, IE_CLASSIFICACAO, DT_ATUALIZACAO_NREC,NM_USUARIO_NREC,IE_OBRIGA_NEWS,IE_OS_RELATORIO,IE_ORIGEM_OS,IE_ENVOLVE_TREINAMENTO,IE_ORIENTACAO_SATISFACAO,IE_ATUALIZACAO_MIGRACAO, IE_OBRIGAR_AVALIACAO,IE_SOLIC_VIP )  VALUES ($NR_SEQUENCIA, $NR_SEQ_LOCALIZACAO, $NR_SEQ_EQUIPAMENTO, $CD_PESSOA_SOLICITANTE, $DT_ORDEM_SERVICO, $IE_PRIORIDADE, $IE_PARADO, $DS_DANO_BREVE, $DT_ATUALIZACAO, $NM_USUARIO, $DT_INICIO_DESEJADO, $DT_CONCLUSAO_DESEJADA, $DS_DANO, $IE_TIPO_ORDEM, $IE_STATUS_ORDEM, $NR_GRUPO_PLANEJ, $NR_GRUPO_TRABALHO, $IE_CLASSIFICACAO, $DT_ATUALIZACAO_NREC,$NM_USUARIO_NREC,$IE_OBRIGA_NEWS,$IE_OS_RELATORIO,$IE_ORIGEM_OS,$IE_ENVOLVE_TREINAMENTO,$IE_ORIENTACAO_SATISFACAO,$IE_ATUALIZACAO_MIGRACAO, $IE_OBRIGAR_AVALIACAO,$IE_SOLIC_VIP);",
      {
        bind: {
          NR_SEQUENCIA: seq,
          NR_SEQ_LOCALIZACAO: localicazao,
          NR_SEQ_EQUIPAMENTO: equipamento,
          CD_PESSOA_SOLICITANTE: cod_user,
          DT_ORDEM_SERVICO: data,
          IE_PRIORIDADE: prioridade,
          IE_PARADO: situacao,
          DS_DANO_BREVE: dano,
          DT_ATUALIZACAO: data,
          NM_USUARIO: user as string,
          DT_INICIO_DESEJADO: data,
          DT_CONCLUSAO_DESEJADA: new Date(
            year +
              "/" +
              month +
              "/" +
              (parseInt(date) + 2) +
              " " +
              hours +
              ":" +
              minutes +
              ":" +
              seconds
          ),
          DS_DANO: descricao,
          IE_TIPO_ORDEM: 1,
          IE_STATUS_ORDEM: "1",
          NR_GRUPO_PLANEJ: 22,
          NR_GRUPO_TRABALHO: 12,
          IE_CLASSIFICACAO: classif,
          DT_ATUALIZACAO_NREC: data,
          NM_USUARIO_NREC: user as string,
          IE_OBRIGA_NEWS: "S",
          IE_OS_RELATORIO: "N",
          IE_ORIGEM_OS: "4",
          IE_ENVOLVE_TREINAMENTO: "N",
          IE_ORIENTACAO_SATISFACAO: "N",
          IE_ATUALIZACAO_MIGRACAO: "P",
          IE_OBRIGAR_AVALIACAO: "N",
          IE_SOLIC_VIP: "N",
        },
        type: QueryTypes.INSERT,
      }
    );
    const next_val = await class_tb.sequelize?.query(
      "SELECT MAN_ORDEM_SERVICO_SEQ.nextval FROM dual"
    );
    res.json({ seq, next_val });
  } catch (err) {
    res.status(404).send({ error: err });
  }
};
