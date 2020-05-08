import sequelize from 'sequelize';
import {
    Genre,
    Person,
    Title,
    TitleCast,
    TitleDescription,
    TitleEpisode,
    TitleGenre,
    TitleImage,
    TitleMedia,
    TitleName,
    TitleRating,
    TitleSubtitles
} from "./model";

class Backend {
    /**
     * @type Sequelize
     */
    db;

    constructor(db) {
        this.db = db;

        Genre.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            tmdb_id: sequelize.DataTypes.INTEGER,
            name: sequelize.DataTypes.TEXT,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'genre',
            indexes: []
        });
        Person.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            imdb_id: sequelize.DataTypes.STRING(64),
            name: sequelize.DataTypes.TEXT,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'people',
            indexes: []
        });
        Title.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            imdb_id: sequelize.DataTypes.STRING(64),
            tmdb_id: sequelize.DataTypes.INTEGER,
            tvdb_id: sequelize.DataTypes.INTEGER,
            original_language: sequelize.DataTypes.STRING(32),
            runtime: sequelize.DataTypes.INTEGER,
            year_start: sequelize.DataTypes.INTEGER,
            year_end: sequelize.DataTypes.INTEGER,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title',
            indexes: []
        });
        TitleCast.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            category: sequelize.DataTypes.TEXT,
            characters: sequelize.DataTypes.ARRAY(sequelize.DataTypes.TEXT),
            job: sequelize.DataTypes.TEXT,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_cast',
            indexes: []
        });
        TitleCast.belongsTo(Title);
        Title.hasMany(TitleCast);
        TitleCast.belongsTo(Person);
        Person.hasMany(TitleCast);

        TitleDescription.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            region: sequelize.DataTypes.STRING(32),
            languages: sequelize.DataTypes.ARRAY(sequelize.DataTypes.STRING(32)),
            overview: sequelize.DataTypes.TEXT,
            tagline: sequelize.DataTypes.TEXT,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_description',
            indexes: []
        });
        TitleDescription.belongsTo(Title);
        Title.hasMany(TitleDescription);

        TitleEpisode.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            season_number: sequelize.DataTypes.STRING(64),
            episode_number: sequelize.DataTypes.STRING(64),
            air_date: sequelize.DataTypes.DATEONLY,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_episode',
            indexes: [
                {
                    fields: [
                        'show_id',
                        {
                            attribute: 'season_number',
                            collate: 'C',
                            order: 'ASC',
                        },
                        {
                            attribute: 'episode_number',
                            collate: 'C',
                            order: 'ASC',
                        }
                    ]
                },
                {
                    using: 'BTREE',
                    fields: [
                        'show_id',
                        {
                            attribute: 'air_date',
                            order: 'ASC',
                        }
                    ]
                }
            ]
        });
        TitleEpisode.belongsTo(Title, {as: "Show", foreignKey: "show_id"});
        TitleEpisode.belongsTo(Title, {as: "Episode", foreignKey: "episode_id"});
        Title.hasMany(TitleEpisode, { foreignKey: "show_id", as: 'Episodes'});
        Title.hasOne(TitleEpisode, { foreignKey: "episode_id", as: 'Show'});
        TitleGenre.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            title_id: sequelize.DataTypes.UUID,
            genre_id: sequelize.DataTypes.UUID,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_genre',
            indexes: []
        });
        TitleGenre.belongsTo(Title);
        Title.hasMany(TitleGenre);
        TitleGenre.belongsTo(Genre);
        Genre.hasMany(TitleGenre);
        TitleImage.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            type: sequelize.DataTypes.STRING(64),
            mime: sequelize.DataTypes.TEXT,
            src: sequelize.DataTypes.TEXT,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_image',
            indexes: []
        });
        TitleImage.belongsTo(Title);
        Title.hasMany(TitleImage);
        TitleMedia.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            mime: sequelize.DataTypes.STRING(64),
            codecs: sequelize.DataTypes.ARRAY(sequelize.DataTypes.STRING(64)),
            languages: sequelize.DataTypes.ARRAY(sequelize.DataTypes.STRING(32)),
            src: sequelize.DataTypes.TEXT,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_media',
            indexes: []
        });
        TitleMedia.belongsTo(Title);
        Title.hasMany(TitleMedia);
        TitleName.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            region: sequelize.DataTypes.STRING(32),
            languages: sequelize.DataTypes.ARRAY(sequelize.DataTypes.STRING(32)),
            original: sequelize.DataTypes.BOOLEAN,
            name: sequelize.DataTypes.TEXT,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_name',
            indexes: []
        });
        TitleName.belongsTo(Title);
        Title.hasMany(TitleName);
        TitleRating.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            region: sequelize.DataTypes.STRING(32),
            certification: sequelize.DataTypes.STRING(32),
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_rating',
            indexes: []
        });
        TitleRating.belongsTo(Title);
        Title.hasMany(TitleRating);
        TitleSubtitles.init({
            id: {
                type: sequelize.DataTypes.UUID,
                defaultValue: sequelize.DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true
            },
            format: sequelize.DataTypes.STRING(64),
            language: sequelize.DataTypes.STRING(64),
            region: sequelize.DataTypes.STRING(64),
            specifier: sequelize.DataTypes.STRING(64),
            src: sequelize.DataTypes.TEXT,
        }, {
            sequelize: this.db,
            underscored: true,
            modelName: 'title_subtitles',
            indexes: []
        });
        TitleSubtitles.belongsTo(Title);
        Title.hasMany(TitleSubtitles);
    }

    async sync() {
        await Promise.all([
            Genre.sync(), Person.sync(), Title.sync(),
            TitleCast.sync(), TitleDescription.sync(), TitleEpisode.sync(), TitleGenre.sync(), TitleImage.sync(),
            TitleMedia.sync(), TitleName.sync(), TitleRating.sync(), TitleSubtitles.sync(),
        ]);
    }

}

export default Backend;