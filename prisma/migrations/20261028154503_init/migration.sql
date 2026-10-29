-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('DRAFT', 'PREVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StoryNodeStatus" AS ENUM ('PLANNED', 'ACTIVE', 'PRODUCED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "EpisodeStatus" AS ENUM ('PLANNED', 'PENDING_SCRIPT', 'SCRIPTING', 'SCRIPT_REVIEW', 'SCRIPT_FAILED', 'PENDING_ASSETS', 'ASSETS', 'ASSET_REVIEW', 'ASSETS_FAILED', 'PENDING_VOICE', 'VOICING', 'VOICE_FAILED', 'PENDING_RENDER', 'RENDERING', 'RENDER_REVIEW', 'RENDER_FAILED', 'READY', 'POSTED', 'VOTING', 'VOTE_CLOSED', 'DONE');

-- CreateEnum
CREATE TYPE "VoteStatus" AS ENUM ('OPEN', 'CLOSED', 'APPLIED');

-- CreateEnum
CREATE TYPE "VoteCriterio" AS ENUM ('maioria', 'empate_padrao', 'poucos_votos_padrao', 'manual');

-- CreateEnum
CREATE TYPE "Opcao" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "CommentVoto" AS ENUM ('A', 'B', 'NULO', 'AMBIGUO');

-- CreateEnum
CREATE TYPE "CommentOrigem" AS ENUM ('regex', 'claude', 'manual');

-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "bibliaPath" TEXT NOT NULL,
    "vozNarrador" TEXT NOT NULL DEFAULT 'pt-BR-AntonioNeural',
    "config" JSONB NOT NULL DEFAULT '{"duracaoMinS":65,"duracaoMaxS":90,"janelaVotacaoH":24,"minimoVotos":15}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "serieId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'DRAFT',
    "spec" JSONB,
    "previewPath" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "poses" JSONB,
    "vozId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "serieId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'DRAFT',
    "spec" JSONB,
    "previewPath" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prop" (
    "id" TEXT NOT NULL,
    "serieId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'DRAFT',
    "spec" JSONB,
    "previewPath" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Infographic" (
    "id" TEXT NOT NULL,
    "serieId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'DRAFT',
    "spec" JSONB,
    "previewPath" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Infographic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryNode" (
    "id" TEXT NOT NULL,
    "serieId" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "resumo" TEXT NOT NULL,
    "temVotacao" BOOLEAN NOT NULL DEFAULT false,
    "opcaoA" TEXT,
    "opcaoB" TEXT,
    "noSeA" TEXT,
    "noSeB" TEXT,
    "efeitosA" JSONB,
    "efeitosB" JSONB,
    "opcaoPadrao" "Opcao" NOT NULL DEFAULT 'A',
    "convergencia" BOOLEAN NOT NULL DEFAULT false,
    "status" "StoryNodeStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "storyNodeId" TEXT NOT NULL,
    "roteiro" JSONB,
    "resultadoAnterior" JSONB,
    "comentarioRevisao" TEXT,
    "estadoAntes" JSONB,
    "estadoDepois" JSONB,
    "checagens" JSONB,
    "status" "EpisodeStatus" NOT NULL DEFAULT 'PLANNED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "logs" TEXT NOT NULL DEFAULT '',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "renderPath" TEXT,
    "duracaoReal" DOUBLE PRECISION,
    "copyTitulo" TEXT,
    "copyLegenda" TEXT,
    "bufferPostId" TEXT,
    "postadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shot" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "audioPath" TEXT,
    "falaPath" TEXT,
    "palavras" JSONB,
    "duracaoFinal" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "abreEm" TIMESTAMP(3) NOT NULL,
    "fechaEm" TIMESTAMP(3) NOT NULL,
    "status" "VoteStatus" NOT NULL DEFAULT 'OPEN',
    "votosA" INTEGER NOT NULL DEFAULT 0,
    "votosB" INTEGER NOT NULL DEFAULT 0,
    "nulos" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "vencedora" "Opcao",
    "criterio" "VoteCriterio",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "voteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL,
    "voto" "CommentVoto" NOT NULL,
    "origem" "CommentOrigem" NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryState" (
    "id" TEXT NOT NULL,
    "serieId" TEXT NOT NULL,
    "episodeId" TEXT,
    "estado" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeMetrics" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "curtidas" INTEGER NOT NULL DEFAULT 0,
    "comentarios" INTEGER NOT NULL DEFAULT 0,
    "compartilhamentos" INTEGER NOT NULL DEFAULT 0,
    "tempoMedioAssistidoS" DOUBLE PRECISION,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EpisodeMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "pilotoAutomatico" BOOLEAN NOT NULL DEFAULT false,
    "serieAtiva" TEXT,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Series_slug_key" ON "Series"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Character_serieId_assetId_key" ON "Character"("serieId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_serieId_assetId_key" ON "Location"("serieId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Prop_serieId_assetId_key" ON "Prop"("serieId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Infographic_serieId_assetId_key" ON "Infographic"("serieId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryNode_serieId_no_key" ON "StoryNode"("serieId", "no");

-- CreateIndex
CREATE INDEX "Episode_status_createdAt_idx" ON "Episode"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Shot_episodeId_planoId_key" ON "Shot"("episodeId", "planoId");

-- CreateIndex
CREATE INDEX "Vote_status_fechaEm_idx" ON "Vote"("status", "fechaEm");

-- CreateIndex
CREATE UNIQUE INDEX "Comment_voteId_autorId_key" ON "Comment"("voteId", "autorId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryState_episodeId_key" ON "StoryState"("episodeId");

-- CreateIndex
CREATE INDEX "StoryState_serieId_createdAt_idx" ON "StoryState"("serieId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeMetrics_episodeId_key" ON "EpisodeMetrics"("episodeId");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "Series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "Series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prop" ADD CONSTRAINT "Prop_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "Series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Infographic" ADD CONSTRAINT "Infographic_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "Series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryNode" ADD CONSTRAINT "StoryNode_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "Series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_storyNodeId_fkey" FOREIGN KEY ("storyNodeId") REFERENCES "StoryNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_voteId_fkey" FOREIGN KEY ("voteId") REFERENCES "Vote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryState" ADD CONSTRAINT "StoryState_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "Series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryState" ADD CONSTRAINT "StoryState_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeMetrics" ADD CONSTRAINT "EpisodeMetrics_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
